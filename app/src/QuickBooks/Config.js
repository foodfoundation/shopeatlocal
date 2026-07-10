// QuickBooks/Config.js
// --------------------
// Configuration and feature-flag access for the QuickBooks Online integration.

import * as Cfg from "../../Cfg.js";
import FeatureFlags from "../FeatureFlags.js";

export const EnvironmentName = (
  Cfg.QuickBooksEnvironmentName ||
  process.env.QUICKBOOKS_ENVIRONMENT ||
  "sandbox"
).toLowerCase();

export const ClientId = Cfg.QuickBooksClientId || process.env.QUICKBOOKS_CLIENT_ID || "";
export const ClientSecret =
  Cfg.QuickBooksClientSecret || process.env.QUICKBOOKS_CLIENT_SECRET || "";
export const RedirectUri =
  Cfg.QuickBooksRedirectUri ||
  process.env.QUICKBOOKS_REDIRECT_URI ||
  (Cfg.URLBase ? Cfg.URLBase + "/quickbooks/callback" : "");
export const TokenKey = Cfg.QuickBooksTokenKey || process.env.QUICKBOOKS_TOKEN_KEY || "";
export const SyncIntervalMs = Number(
  Cfg.QuickBooksSyncIntervalMs || process.env.QUICKBOOKS_SYNC_INTERVAL_MS || 60_000,
);
export const AlertEmails = (Cfg.QuickBooksAlertEmails || process.env.QUICKBOOKS_ALERT_EMAILS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

/** The IANA time zone used to group payment batches by business date. */
export const TimeZone = Cfg.TimeZoneUser || "America/Chicago";

export const ApiBase =
  EnvironmentName === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";

/** QuickBooks company web UI base, for deep links from the dashboard. */
export const AppBase =
  EnvironmentName === "production"
    ? "https://app.qbo.intuit.com"
    : "https://app.sandbox.qbo.intuit.com";

/** True when the 'quickbooksOnline' feature flag is enabled for the current
 *  environment. Mirrors the 'hCkFeatureFlag' Handlebars helper in View.js. */
export function CkFeatureEnabled() {
  if (Cfg.CkDev) return true;
  if (Cfg.CkTest) return Boolean(FeatureFlags.testEnv.quickbooksOnline);
  return Boolean(FeatureFlags.prodEnv.quickbooksOnline);
}

/** True when credentials and the token-encryption key are configured. */
export function CkConfigured() {
  return Boolean(
    ClientId &&
    ClientId !== "quickbooks_client_id" &&
    ClientSecret &&
    ClientSecret !== "quickbooks_client_secret" &&
    RedirectUri &&
    /^[0-9a-fA-F]{64}$/.test(TokenKey),
  );
}
