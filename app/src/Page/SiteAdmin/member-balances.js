// member-balances.js
// ------------------
// Member Balances page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} member balances`;
  aResp.render("SiteAdmin/member-balances");
}
