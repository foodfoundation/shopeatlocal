// manage-locations.js
// -------------------
// Manage Locations page controller

import { wLocs } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oLocs = await wLocs();
  aResp.locals.LocsActiv = oLocs.filter(o => o.CkActiv);
  aResp.locals.LocsInactiv = oLocs.filter(o => !o.CkActiv);

  aResp.locals.Title = `${CoopParams.CoopNameShort} manage locations`;
  aResp.render("SiteAdmin/manage-locations");
}
