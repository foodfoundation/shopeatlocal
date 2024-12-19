// member-fees.js
// --------------
// Member Fees page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} member fees`;
  aResp.render("SiteAdmin/member-fees");
}
