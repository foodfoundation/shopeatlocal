// producers.js
// ------------
// Producers page controllers

import { wProducersActivWeb } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Producers = await wProducersActivWeb();
  aResp.locals.Title = aReq.t("common:pageTitles.producers", { name: CoopParams.CoopNameShort });
  aResp.render("Home/producers");
}
