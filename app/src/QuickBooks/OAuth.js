// QuickBooks/OAuth.js
// -------------------
// Thin adapter around Intuit's official 'intuit-oauth' client. The SDK owns
// authorization URIs, token exchange, refresh, revocation, and environment
// base URLs; this module owns application persistence, encryption, refresh
// serialization, and sanitized logging.

import OAuthClient from "intuit-oauth";
import { randomBytes } from "node:crypto";
import { ClientId, ClientSecret, EnvironmentName, RedirectUri } from "./Config.js";
import {
  TokensFromConnection,
  wConnection,
  wUpd_ConnectionStatus,
  wUpd_ConnectionTokens,
  wUpsert_Connection,
  wWithConnectionLock,
  wAdd_Event,
} from "./Db.js";

/** Refresh when the access token has less than this many milliseconds left. */
const MsExpiryMargin = 5 * 60 * 1000;

export function OAuthClientNew(aToken) {
  if (!ClientId || !ClientSecret || !RedirectUri)
    throw Error("QuickBooks OAuth: Client credentials are not configured.");
  return new OAuthClient({
    clientId: ClientId,
    clientSecret: ClientSecret,
    environment: EnvironmentName,
    redirectUri: RedirectUri,
    ...(aToken ? { token: aToken } : {}),
  });
}

/** Returns { URL, State } for the authorization redirect. The caller must
 *  store State (in the session) and validate it in the callback. */
export function AuthorizeUri() {
  const oState = randomBytes(24).toString("hex");
  const oClient = OAuthClientNew();
  const oURL = oClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: oState,
  });
  return { URL: oURL, State: oState };
}

function tokensFromAuthResponse(aJSON) {
  const oNow = Date.now();
  return {
    AccessToken: aJSON.access_token,
    RefreshToken: aJSON.refresh_token,
    WhenAccessTokenExpires: new Date(oNow + Number(aJSON.expires_in) * 1000),
    WhenRefreshTokenExpires: new Date(oNow + Number(aJSON.x_refresh_token_expires_in) * 1000),
  };
}

/** Exchanges the authorization-code callback URL for tokens and persists the
 *  connection. aParseRedirect is the full callback URL; aState/aStateExpect
 *  must match (CSRF protection). */
export async function wHandleCallback(aParseRedirect, aState, aStateExpect, aIDMembStaff) {
  if (!aStateExpect || aState !== aStateExpect)
    throw Error("QuickBooks OAuth: Invalid state parameter.");

  const oClient = OAuthClientNew();
  const oAuthResp = await oClient.createToken(aParseRedirect);
  const oJSON = oAuthResp.json || oAuthResp.getJson?.() || {};
  const oRealmID = oClient.getToken().realmId;
  if (!oRealmID) throw Error("QuickBooks OAuth: Authorization did not return a realm ID.");

  const oConnection = await wUpsert_Connection({
    RealmID: String(oRealmID),
    EnvironmentName,
    IDMembStaffConnect: aIDMembStaff,
    ...tokensFromAuthResponse(oJSON),
  });

  await wAdd_Event({
    CdTypeQuickBooksEvent: "Connect",
    RealmID: String(oRealmID),
    IDMembStaffCreate: aIDMembStaff,
    Detail: { EnvironmentName },
  });
  return oConnection;
}

/** Refreshes tokens under a row lock and persists the rotated pair
 *  atomically. Returns the fresh access token. */
async function wRefreshLocked(aIDConnection) {
  return await wWithConnectionLock(aIDConnection, async (aRow, aConn) => {
    // Another request may have refreshed while we waited for the lock:
    if (
      aRow.WhenAccessTokenExpires &&
      new Date(aRow.WhenAccessTokenExpires).getTime() - Date.now() > MsExpiryMargin
    )
      return TokensFromConnection(aRow).AccessToken;

    const oTokens = TokensFromConnection(aRow);
    const oClient = OAuthClientNew();
    try {
      const oAuthResp = await oClient.refreshUsingToken(oTokens.RefreshToken);
      const oJSON = oAuthResp.json || {};
      const oNew = tokensFromAuthResponse(oJSON);
      await wUpd_ConnectionTokens(aRow.IDQuickBooksConnection, oNew, aConn);
      return oNew.AccessToken;
    } catch (aErr) {
      const oStatus = aErr?.authResponse?.response?.status || aErr?.status;
      // An invalid grant means the rotated refresh token is dead; the realm
      // must be reauthorized by staff:
      if (oStatus === 400 || oStatus === 401) {
        await wUpd_ConnectionStatus(aRow.IDQuickBooksConnection, "Expired", aConn);
        await wAdd_Event(
          {
            CdTypeQuickBooksEvent: "TokenRefreshFail",
            RealmID: aRow.RealmID,
            Detail: { Status: oStatus },
          },
          aConn,
        );
      }
      throw aErr;
    }
  });
}

/** Returns { Connection, AccessToken } with a valid access token, refreshing
 *  if it is near expiry. Throws if no healthy connection exists. */
export async function wFreshConnection(aCkForceRefresh = false) {
  const oConnection = await wConnection();
  if (!oConnection) throw Error("QuickBooks is not connected.");
  if (oConnection.CdStatusQuickBooksConnection !== "Connected")
    throw Error(`QuickBooks connection is ${oConnection.CdStatusQuickBooksConnection}.`);

  const oMsLeft = oConnection.WhenAccessTokenExpires
    ? new Date(oConnection.WhenAccessTokenExpires).getTime() - Date.now()
    : 0;
  if (!aCkForceRefresh && oMsLeft > MsExpiryMargin)
    return { Connection: oConnection, AccessToken: TokensFromConnection(oConnection).AccessToken };

  const oAccessToken = await wRefreshLocked(oConnection.IDQuickBooksConnection);
  return { Connection: oConnection, AccessToken: oAccessToken };
}

/** Revokes tokens with Intuit and marks the connection disconnected. Queued
 *  jobs are retained; they pause until the realm is reauthorized. */
export async function wDisconnect(aIDMembStaff) {
  const oConnection = await wConnection();
  if (!oConnection) return;

  const oTokens = TokensFromConnection(oConnection);
  if (oTokens.RefreshToken) {
    try {
      const oClient = OAuthClientNew();
      await oClient.revoke({
        token_type: "bearer",
        access_token: oTokens.AccessToken || "",
        refresh_token: oTokens.RefreshToken,
        expires_in: 0,
        x_refresh_token_expires_in: 0,
      });
    } catch (aErr) {
      // Revocation is best-effort; the local disconnect still proceeds.
      console.warn("quickbooks_revoke_failed", aErr?.originalMessage || aErr?.message);
    }
  }

  await wUpd_ConnectionStatus(oConnection.IDQuickBooksConnection, "Disconnected");
  await wAdd_Event({
    CdTypeQuickBooksEvent: "Disconnect",
    RealmID: oConnection.RealmID,
    IDMembStaffCreate: aIDMembStaff,
  });
}
