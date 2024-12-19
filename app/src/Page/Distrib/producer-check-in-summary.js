// producer-check-in-summary.js
// ----------------------------
// Producer Check-in Summary page controller

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDInvc = parseInt(aReq.params.IDInvcProducerWeb);
  const oInvc = await wInvcProducerFromIDInvc(oIDInvc);
  if (!oInvc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  aResp.locals.InvcProducer = oInvc;

  aResp.locals.Title = `${CoopParams.CoopNameShort} producer check-in summary`;
  aResp.render("Distrib/producer-check-in-summary");
}

async function wInvcProducerFromIDInvc(aIDInvc) {
  const oSQL = `SELECT InvcProducerWeb.*,
			Producer.IDProducer, Producer.NameBus,
			Producer.Addr1, Producer.Addr2,
			Producer.City, Producer.St, Producer.Zip,
			Producer.Phone1, Producer.Email,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last,
			Memb.Name2First, Memb.Name2Last,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT
		FROM InvcProducerWeb
		JOIN Producer USING (IDProducer)
		JOIN Memb USING (IDMemb)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE IDInvcProducerWeb = :IDInvc`;
  const oParams = {
    IDInvc: aIDInvc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0] : null;
}
