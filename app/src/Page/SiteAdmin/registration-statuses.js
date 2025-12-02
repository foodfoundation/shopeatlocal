// registration-statuses.js
// ------------------------
// Registration Statuses page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.registrationStatuses", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/registration-statuses");
}
