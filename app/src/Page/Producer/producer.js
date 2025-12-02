// producer.js
// -----------
// Producer page controllers

import { wProducerFromID } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  aResp.locals.Title = aReq.t("common:pageTitles.producer", { name: CoopParams.CoopNameShort });
  aResp.locals.CoopParams = CoopParams;
  aResp.render("Producer/producer");
}
