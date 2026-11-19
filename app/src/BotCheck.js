// BotCheck.js
// -----------
// Optional Cloudflare Turnstile, plus a honeypot and a minimum form-fill time.

import crypto from "crypto";
import * as Cfg from "../Cfg.js";

const oMsMinForm = 3 * 1000;
const oMsMaxForm = 12 * 60 * 60 * 1000;

function CkStrNonEmpty(aVal) {
  return typeof aVal === "string" && aVal.length > 0;
}

const oCkSiteKey = CkStrNonEmpty(Cfg.TurnstileSiteKey);
const oCkSecret = CkStrNonEmpty(Cfg.TurnstileSecret);
const oCkHosts = Array.isArray(Cfg.TurnstileHostnames) && Cfg.TurnstileHostnames.length > 0;
const oCkTurnstileOn = oCkSiteKey && oCkSecret && oCkHosts;

if ((oCkSiteKey || oCkSecret || oCkHosts) && !oCkTurnstileOn)
  console.warn("BotCheck: Turnstile is disabled because its configuration is incomplete.");

/** The public site key when Turnstile is fully configured, otherwise null. */
export const TurnstileSiteKey = oCkTurnstileOn ? Cfg.TurnstileSiteKey : null;

export function CkTurnstileOn() {
  return TurnstileSiteKey !== null;
}

/** Returns true when the token passes siteverify, or when Turnstile is off. */
export async function wCkTurnstile(aToken, aIP, aAction) {
  if (!CkTurnstileOn()) return true;

  if (typeof aToken !== "string" || aToken.length === 0 || aToken.length > 2048) return false;

  let oResult;
  try {
    const oResp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: Cfg.TurnstileSecret,
        response: aToken,
        remoteip: aIP,
      }),
    });
    if (!oResp.ok) return false;
    oResult = await oResp.json();
  } catch {
    return false;
  }

  return (
    !!oResult &&
    oResult.success === true &&
    oResult.action === aAction &&
    Cfg.TurnstileHostnames.includes(oResult.hostname)
  );
}

function oSigTime(aWhen) {
  return crypto.createHmac("sha256", Cfg.SecretCookSess).update(String(aWhen)).digest("hex");
}

/** A signed timestamp the form must post back. */
export function TokTimeFormNew() {
  const oWhen = Date.now();
  return `${oWhen}.${oSigTime(oWhen)}`;
}

/** True when the token is genuine and between 3 seconds and 12 hours old. */
export function CkTokTimeForm(aTok) {
  if (typeof aTok !== "string") return false;

  const oParts = aTok.split(".");
  if (oParts.length !== 2) return false;

  const [oWhenText, oSig] = oParts;
  if (!/^\d+$/.test(oWhenText)) return false;

  const oExpect = oSigTime(oWhenText);
  const oBufSig = Buffer.from(oSig);
  const oBufExpect = Buffer.from(oExpect);
  if (oBufSig.length !== oBufExpect.length) return false;
  if (!crypto.timingSafeEqual(oBufSig, oBufExpect)) return false;

  const oAge = Date.now() - Number(oWhenText);
  return oAge >= oMsMinForm && oAge <= oMsMaxForm;
}

/** True when the honeypot was left empty. */
export function CkHoneypot(aBody) {
  return aBody.UrlHomepage === undefined || aBody.UrlHomepage === "";
}
