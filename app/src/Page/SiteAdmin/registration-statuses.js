// registration-statuses.js
// ------------------------
// Registration Statuses page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} registration statuses`;
  aResp.render("SiteAdmin/registration-statuses");
}
