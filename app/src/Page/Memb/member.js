// member.js
// ---------
// Member page controllers

import { PayPalClientId } from "../../../Cfg.js";
import { wMembFromID, wFeeMembNextFromIDMemb } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;

  const oMemb = await wMembFromID(oIDMemb);
  aResp.locals.PayPalClientId = PayPalClientId;
  aResp.locals.Memb = oMemb;

  aResp.locals.Bal = oMemb.BalMoney + oMemb.BalEBT;
  aResp.locals.FeeMembNext = await wFeeMembNextFromIDMemb(oIDMemb);

  aResp.locals.Title = aReq.t("common:pageTitles.member", { name: CoopParams.CoopNameShort });
  aResp.render("Memb/member");
}
