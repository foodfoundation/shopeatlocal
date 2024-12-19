// on-site.js
// ----------
// On-site home page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} on-site`;

  aResp.render("Onsite/on-site");
}
