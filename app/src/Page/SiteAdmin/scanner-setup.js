// scanner-setup.js
// ----------------
// Scanner Setup page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} scanner setup`;
  aResp.render("SiteAdmin/scanner-setup");
}
