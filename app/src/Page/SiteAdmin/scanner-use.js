// scanner-use.js
// --------------
// Scanner Use page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} scanner use`;
  aResp.render("SiteAdmin/scanner-use");
}
