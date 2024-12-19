// producers.js
// ------------
// Producers page controllers

import { wProducersActivWeb } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Producers = await wProducersActivWeb();
  aResp.locals.Title = `${CoopParams.CoopNameShort} producers`;
  aResp.render("Home/producers");
}
