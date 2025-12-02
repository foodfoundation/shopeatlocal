// on-site.js
// ----------
// On-site home page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.onSite", { name: CoopParams.CoopNameShort });

  aResp.render("Onsite/on-site");
}
