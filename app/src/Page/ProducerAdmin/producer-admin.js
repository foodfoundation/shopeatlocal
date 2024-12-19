// producer-admin.js
// -----------------
// Producer Admin page controllers

import { Conn } from "../../Db.js";
import { PathQuery, NamesParamProducer } from "../../Search.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.CtProducerPend = await wCtProducerPend();
  aResp.locals.CtProducerList = await wCtProducerList();
  aResp.locals.CtProducerWithSale = await wCtProducerWithSale();
  aResp.locals.CtProductEdit = await wCtProductEdit();
  aResp.locals.CtProducerIsWholesale = await wCtProducerIsWholesale();

  aResp.locals.Title = `${CoopParams.CoopNameShort} producer admin`;
  aResp.render("ProducerAdmin/producer-admin");
}

export function HandPost(aReq, aResp) {
  // It doesn't seem useful to validate search parameters. In fact, if invalid
  // data finds its way into the database, we will want to be able to select it
  // here.

  const oPath = PathQuery("/producer-search-results", aReq.body, NamesParamProducer);
  aResp.redirect(303, oPath);
}

async function wCtProducerPend() {
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM Producer
		WHERE CdRegProducer = 'Pend'`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("producer-admin wCtProducerPend: Cannot get count");
  return oRows[0].Ct;
}

async function wCtProducerList() {
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM Producer
		WHERE CkListProducer = 1`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("producer-admin wCtProducerList: Cannot get count");
  return oRows[0].Ct;
}

async function wCtProducerWithSale() {
  const oSQL = `SELECT COUNT(DISTINCT Producer.IDProducer) AS Ct
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("producer-admin wCtProducerWithSale: Cannot get count");
  return oRows[0].Ct;
}

async function wCtProductEdit() {
  const oSQL = `SELECT COUNT(DISTINCT Product.IDProduct) AS Ct
		FROM Product
		JOIN Vty USING (IDProduct)
		WHERE (Product.WhenEdit >= DATE_SUB(NOW(), INTERVAL 1 MONTH))
			OR (Vty.WhenEdit >= DATE_SUB(NOW(), INTERVAL 1 MONTH))`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("producer-admin wProductsEdit: Cannot get count");
  return oRows[0].Ct;
}

async function wCtProducerIsWholesale() {
  const oSQL = `SELECT COUNT(*) AS Ct
			FROM Producer
			WHERE CdRegWholesale = 'Approv'
		`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("producer-admin wCtProducerIsWholesale: Cannot get count");
  return oRows[0].Ct;
}
