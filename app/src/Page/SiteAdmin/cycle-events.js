// cycle-events.js
// ---------------
// Cycle Events page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} cycle events`;
  aResp.render("SiteAdmin/cycle-events");
}
