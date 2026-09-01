// member.js
// ---------
// Member page controllers

import * as Cfg from "../../../Cfg.js";
import {
  wFeeMembNextFromIDMemb,
  wMembFromID,
  wSquareMemberPaymentProfileFromIDMemb,
} from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;

  const oMemb = await wMembFromID(oIDMemb);
  aResp.locals.PayPalClientId = Cfg.PayPalClientId;
  aResp.locals.SquareAppId = Cfg.SquareAppId || process.env.SQUARE_APP_ID || "";
  aResp.locals.SquareLocationId = Cfg.SquareLocationId || process.env.SQUARE_LOCATION_ID || "";
  aResp.locals.SquareWebSdkUrl =
    (Cfg.SquareEnvironmentName || process.env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase() ===
    "production"
      ? "https://web.squarecdn.com/v1/square.js"
      : "https://sandbox.web.squarecdn.com/v1/square.js";
  aResp.locals.Memb = oMemb;
  aResp.locals.SquareBillingContactJSON = JSON.stringify({
    givenName: oMemb.Name1First || undefined,
    familyName: oMemb.Name1Last || undefined,
    email: oMemb.Email1 || undefined,
    addressLines: [oMemb.Addr1, oMemb.Addr2].filter(Boolean),
    city: oMemb.City || undefined,
    state: oMemb.St || undefined,
    countryCode: "US",
    postalCode: oMemb.Zip || undefined,
  }).replace(/</g, "\\u003c");
  aResp.locals.SquarePaymentProfile = await wSquareMemberPaymentProfileFromIDMemb(oIDMemb);

  aResp.locals.Bal = oMemb.BalMoney + oMemb.BalEBT;
  aResp.locals.FeeMembNext = await wFeeMembNextFromIDMemb(oIDMemb);

  aResp.locals.Title = `${CoopParams.CoopNameShort} member`;
  aResp.render("Memb/member");
}
