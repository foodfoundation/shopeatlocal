// producer-invoices.js
// --------------------
// Producer Invoices page controllers

import { wProducerFromID, Conn } from "../../Db.js";
import { CompWhenDesc } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // The optional URL parameter allows a specific producer to be selected, but
  // only staff can use that parameter, so I guess there is no need to worry
  // about a producer viewing another producer's data.

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);
  aResp.locals.Invcs = await wInvcs(oIDProducer);

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} producer invoices`;
  aResp.render("Producer/producer-invoices");
}

async function wInvcs(aIDProducer) {
  const oSQLWeb = `SELECT *, WhenUpd AS zWhen
		FROM InvcProducerWeb
		WHERE IDProducer = :IDProducer
		ORDER BY zWhen DESC`;

  const oSQLOnsite = `SELECT *, WhenCreate AS zWhen
		FROM InvcProducerOnsite
		WHERE IDProducer = :IDProducer
		ORDER BY zWhen DESC`;

  const oParams = {
    IDProducer: aIDProducer,
  };
  const [oRowsWeb] = await Conn.wExecPrep(oSQLWeb, oParams);
  const [oRowsOnsite] = await Conn.wExecPrep(oSQLOnsite, oParams);
  const oRows = oRowsWeb.concat(oRowsOnsite);

  const oComp = (aL, aR) => CompWhenDesc(aL, aR, "zWhen");
  oRows.sort(oComp);

  return oRows;
}
