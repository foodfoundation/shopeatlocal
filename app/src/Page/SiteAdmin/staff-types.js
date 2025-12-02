// staff-types.js
// --------------
// Staff Types page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.staffTypes", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/staff-types");
}
