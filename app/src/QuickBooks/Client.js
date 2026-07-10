// QuickBooks/Client.js
// --------------------
// Accounting API access through the official 'intuit-oauth' client. Adds
// stored-token wiring, 'requestid' idempotency, one automatic refresh on 401,
// rate-limit classification, and ambiguous-timeout recovery by query. The SDK
// owns transport, environment base URLs, and Fault parsing.

import { OAuthClientNew, wFreshConnection } from "./OAuth.js";
import { wConnection } from "./Db.js";
import { EnvironmentName } from "./Config.js";

/** Accounting API minor version pinned for stable field behavior. */
const MinorVersion = "75";

/** Classifies an SDK error for retry policy. Returns 'Auth' (refresh/reauth),
 *  'Throttle' (back off per Retry-After), 'Transient' (backoff retry),
 *  'Validation' (permanent; block for review). */
export function CdClassifyError(aErr) {
  const oCode = String(aErr?.code || "");
  if (oCode === "401" || oCode === "403") return "Auth";
  if (oCode === "429" || oCode === "RATE_LIMIT_EXCEEDED") return "Throttle";
  if (
    oCode === "500" ||
    oCode === "502" ||
    oCode === "503" ||
    oCode === "504" ||
    oCode === "INTERNAL_SERVER_ERROR" ||
    oCode === "TIMEOUT_ERROR" ||
    oCode === "NETWORK_ERROR"
  )
    return "Transient";
  return "Validation";
}

/** True when the failure is ambiguous: the write may have been applied even
 *  though no response arrived. Callers must query before retrying. */
export function CkAmbiguousError(aErr) {
  const oCode = String(aErr?.code || "");
  return oCode === "TIMEOUT_ERROR" || oCode === "NETWORK_ERROR";
}

/** Sanitizes an SDK error for storage and staff display. Never includes
 *  tokens or full payloads. */
export function TextError(aErr) {
  const oParts = [aErr?.message || "QuickBooks request failed."];
  if (aErr?.code) oParts.push(`code=${aErr.code}`);
  if (aErr?.fault?.errors?.length) {
    for (const oFaultErr of aErr.fault.errors.slice(0, 3))
      oParts.push(
        `${oFaultErr.code || ""} ${oFaultErr.message || ""} ${oFaultErr.detail || ""}`.trim(),
      );
  }
  if (aErr?.intuitTid) oParts.push(`intuit_tid=${aErr.intuitTid}`);
  return oParts.join(" | ").slice(0, 2000);
}

async function wClientWithToken(aCkForceRefresh = false) {
  const { Connection: oConnection, AccessToken: oAccessToken } =
    await wFreshConnection(aCkForceRefresh);
  const oClient = OAuthClientNew({
    token_type: "bearer",
    access_token: oAccessToken,
    refresh_token: "unused-set-for-sdk-shape",
    expires_in: 3600,
    x_refresh_token_expires_in: 3600,
    realmId: oConnection.RealmID,
    createdAt: Date.now(),
  });
  return { Client: oClient, Connection: oConnection };
}

/** Makes an Accounting API call against the connected realm. aOpts:
 *  Path (below /v3/company/{realm}), Method, Body, RequestID (idempotency for
 *  writes), Query (extra query params). Refreshes once and retries on 401. */
export async function wApiCall(aOpts, aCkRetriedAuth = false) {
  const { Client: oClient, Connection: oConnection } = await wClientWithToken(aCkRetriedAuth);
  const oParams = { minorversion: MinorVersion, ...(aOpts.Query || {}) };
  if (aOpts.RequestID) oParams.requestid = aOpts.RequestID;

  try {
    const oResp = await oClient.makeApiCall({
      url: `/v3/company/${oConnection.RealmID}/${aOpts.Path}`,
      method: aOpts.Method || "GET",
      headers: { "Content-Type": "application/json" },
      body: aOpts.Body ?? undefined,
      params: oParams,
    });
    return oResp.json;
  } catch (aErr) {
    if (!aCkRetriedAuth && String(aErr?.code) === "401") return await wApiCall(aOpts, true);
    throw aErr;
  }
}

/** Runs a QBO SQL-ish query and returns the QueryResponse object. */
export async function wQuery(aQuery) {
  const oResp = await wApiCall({
    Path: "query",
    Query: { query: aQuery },
  });
  return oResp?.QueryResponse || {};
}

function escQuery(aVal) {
  return String(aVal).replace(/'/g, "\\'");
}

/** Finds a single entity by exact field match, e.g.
 *  wQueryOne("Account", "Name", "Sales"). Returns the entity or null. */
export async function wQueryOne(aEntity, aFld, aVal) {
  const oResp = await wQuery(`select * from ${aEntity} where ${aFld} = '${escQuery(aVal)}'`);
  const oRows = oResp[aEntity] || [];
  return oRows.length ? oRows[0] : null;
}

/** Finds a document by DocNumber, used to detect writes that were applied
 *  before an ambiguous timeout. */
export async function wQueryByDocNumber(aEntity, aDocNumber) {
  return await wQueryOne(aEntity, "DocNumber", aDocNumber);
}

/** Creates an entity (JournalEntry, Bill, VendorCredit, BillPayment, Account,
 *  Class, Item, Customer, Vendor). Returns the created entity. */
export async function wCreate(aEntity, aBody, aRequestID) {
  const oResp = await wApiCall({
    Path: aEntity.toLowerCase(),
    Method: "POST",
    Body: aBody,
    RequestID: aRequestID,
  });
  const oCreated = oResp?.[aEntity];
  if (!oCreated?.Id) throw Error(`QuickBooks did not return a created ${aEntity}.`);
  return oCreated;
}

/** Reads CompanyInfo for the connected realm. */
export async function wCompanyInfo() {
  const oConnection = await wConnection();
  if (!oConnection) throw Error("QuickBooks is not connected.");
  const oResp = await wApiCall({ Path: `companyinfo/${oConnection.RealmID}` });
  return oResp?.CompanyInfo || null;
}

/** Guards against posting to the wrong environment/realm combination. */
export function CkRealmEnvironmentMatch(aConnection) {
  return aConnection.EnvironmentName === EnvironmentName;
}
