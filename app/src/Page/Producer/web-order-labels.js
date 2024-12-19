// web-order-labels.js
// -------------------
// Web Order Labels page controllers

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} web order labels`;

  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  aResp.locals.Qtys = await wQtys(oIDProducer);
  aResp.locals.ProducerId = oIDProducer;

  aResp.render("Producer/web-order-labels");
}

/** Returns an object containing the following properties:
 *
 *  QtyTtl: The total label count;
 *  QtyWgt: The number of weighted labels;
 *  QtyWgtSet: The number of set weighted labels;
 *  QtyWgtUnset: The number of unset weighted labels.
 */
export async function wQtys(aIDProducer, aConn) {
  if (!aConn) aConn = Conn;

  const oSQLWgt = `SELECT COUNT(*) AS QtyWgt,
			SUM(IF(WgtLblOrdWeb.WgtPer IS NULL, 0, 1)) AS QtyWgtSet
		FROM WgtLblOrdWeb
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		WHERE (Vty.CkInvtMgd IS FALSE)
			AND (IDProducer = ?)`;
  const [oRowsWgt] = await aConn.wExecPrep(oSQLWgt, [aIDProducer]);
  if (oRowsWgt.length != 1) throw Error("web-order-labels wCts: Cannot get weight counts");

  const oSQLVty = `SELECT SUM(ItCart.QtyProm) AS 'QtyTtl'
		FROM Vty
		JOIN ItCart USING (IDVty)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Product USING (IDProduct)
		WHERE (Vty.CkInvtMgd IS FALSE)
			AND (IDProducer = ?)`;
  const [oRowsVty] = await aConn.wExecPrep(oSQLVty, [aIDProducer]);
  if (oRowsVty.length != 1) throw Error("web-order-labels wCts: Cannot get label count");

  return {
    ...oRowsWgt[0],
    QtyWgtUnset: oRowsWgt[0].QtyWgt - oRowsWgt[0].QtyWgtSet,

    ...oRowsVty[0],
  };
}
