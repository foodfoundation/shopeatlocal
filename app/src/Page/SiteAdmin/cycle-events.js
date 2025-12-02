// cycle-events.js
// ---------------
// Cycle Events page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.cycleEvents", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/cycle-events");
}
