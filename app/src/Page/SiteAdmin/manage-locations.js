// manage-locations.js
// -------------------
// Manage Locations page controller

import { wLocs } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oLocs = await wLocs();
  aResp.locals.LocsActiv = oLocs.filter(o => o.CkActiv);
  aResp.locals.LocsInactiv = oLocs.filter(o => !o.CkActiv);

  aResp.locals.Title = aReq.t("common:pageTitles.manageLocations", { name: CoopParams.CoopNameShort });
  aResp.render("SiteAdmin/manage-locations");
}
