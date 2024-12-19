// staff-types.js
// --------------
// Staff Types page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} staff types`;
  aResp.render("SiteAdmin/staff-types");
}
