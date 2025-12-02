// scanner-use.js
// --------------
// Scanner Use page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.scannerUse", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/scanner-use");
}
