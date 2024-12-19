// delivery-progress.js
// --------------------
// Delivery Progress page controllers

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  if (aResp.PhaseCycLess("StartDeliv")) {
    const oMsg = "<strong>Cannot check-in!</strong> The delivery window has not started.";
    aResp.Show_Flash("danger", null, oMsg);

    aResp.redirect(303, "/distribution");
    return;
  }

  // Get producer data
  // -----------------

  const oProducers = await wProducers();

  aResp.locals.Pend = {
    Producers: [],
    CtIt: 0,
  };
  aResp.locals.Done = {
    Producers: [],
    CtIt: 0,
  };
  oProducers.forEach(o => {
    if (o.IDInvcProducerWeb === null) {
      aResp.locals.Pend.Producers.push(o);
      aResp.locals.Pend.CtIt += o.QtyProm;
    } else {
      aResp.locals.Done.Producers.push(o);
      aResp.locals.Done.CtIt += o.QtyDeliv;
    }
  });

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} delivery progress`;
  aResp.render("Distrib/delivery-progress");
}

async function wProducers() {
  const oSQL = `SELECT SUM(ItCart.QtyProm) AS QtyProm, SUM(ItCart.QtyDeliv) AS QtyDeliv,
			Producer.IDProducer, Producer.NameBus, Producer.City,
			Producer.Phone1, Producer.Email,
			InvcProducerWeb.IDInvcProducerWeb, InvcProducerWeb.WhenUpd
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		LEFT JOIN InvcProducerWeb USING (IDCyc, IDProducer)
		GROUP BY IDProducer, IDInvcProducerWeb, WhenUpd
		HAVING QtyProm > 0
		ORDER BY Producer.NameBus, Producer.IDProducer`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}
