// scanner-setup.js
// ----------------
// Scanner Setup page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.scannerSetup", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/scanner-setup");
}
