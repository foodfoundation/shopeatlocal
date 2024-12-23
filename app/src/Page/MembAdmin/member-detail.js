// member-detail.js
// ----------------
// Member detail page controllers

import { wMembFromID, wFeeMembNextFromIDMemb, wDataPromMemb } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  aResp.locals.Memb = await wMembFromID(oIDMemb);
  aResp.locals.Memb.FeeMembNext = await wFeeMembNextFromIDMemb(oIDMemb);

  const oDataProm = await wDataPromMemb(oIDMemb);
  aResp.locals.Memb.IDCart = oDataProm.IDCart;
  aResp.locals.Memb.QtyProm = oDataProm.QtyProm;

  aResp.locals.Title = `${CoopParams.CoopNameShort} member detail`;
  aResp.render("MembAdmin/member-detail");
}
