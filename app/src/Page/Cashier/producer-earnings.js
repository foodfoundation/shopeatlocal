/** Producer Earnings Analysis Module
 *  @module producer-earnings
 *  @requires Db
 *  @requires Util
 *  @requires Site
 *  @requires CSV
 */

import { wCycFromID, Conn } from "../../Db.js";
import { Fmt_RowExcel } from "../../Util.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, though
// the export is not used:
import _gCSV from "../../CSV.js";

/** Cycle validation utility
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<Object|null>} Cycle object if valid, null otherwise
 */
async function wCycFromReq(aReq, aResp) {
  let oCyc;

  if (aReq.params.IDCyc) {
    oCyc = await wCycFromID(aReq.params.IDCyc);
    if (oCyc) return oCyc;

    aResp.status(404);
    aResp.render("Misc/404");
    return null;
  }

  oCyc = aResp.locals.CycPrev;
  if (oCyc) return oCyc;

  aResp.Show_Flash("danger", null, aReq.t("common:producerEarnings.cannotCompileNoPreviousCycle"));
  aResp.redirect(303, "/cashier");
  return null;
}

/** GET handler for earnings analysis interface
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Renders earnings analysis view
 */
export async function wHandGet(aReq, aResp) {
  const oCyc = await wCycFromReq(aReq, aResp);
  if (!oCyc) return;

  aResp.locals.Cyc = oCyc;
  aResp.locals.ProducersWeb = await wProducersWeb(oCyc.IDCyc);
  aResp.locals.ProducersOnsiteRetail = await wProducersOnsite(oCyc.IDCyc, "Retail");
  aResp.locals.ProducersOnsiteWholesale = await wProducersOnsite(oCyc.IDCyc, "Wholesale");

  aResp.locals.Title = aReq.t("common:pageTitles.producerEarnings", { name: CoopParams.CoopNameShort });
  aResp.render("Cashier/producer-earnings");
}

/** Web sales export handler
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Exports web sales data as CSV
 */
export async function wHandGetExportWeb(aReq, aResp) {
  const oCyc = await wCycFromReq(aReq, aResp);
  if (!oCyc) return;

  const oProducers = await wProducersWeb(oCyc.IDCyc);

  for (const oProducer of oProducers) Fmt_RowExcel(oProducer);

  aResp.attachment(aReq.t("common:exportFilenames.webEarnings") + ".csv");
  aResp.csv(oProducers, true);
}

/** Onsite sales export handler
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Exports onsite sales data as CSV
 */
export async function wHandGetExportOnsite(aReq, aResp) {
  const oCyc = await wCycFromReq(aReq, aResp);
  if (!oCyc) return;

  const oProducersRetail = await wProducersOnsite(oCyc.IDCyc, "Retail");
  const oProducersWholesale = await wProducersOnsite(oCyc.IDCyc, "Wholesale");
  const oProducers = [...oProducersRetail, ...oProducersWholesale];

  for (const oProducer of oProducers) Fmt_RowExcel(oProducer);

  aResp.attachment(aReq.t("common:exportFilenames.onSiteEarnings") + ".csv");
  aResp.csv(oProducers, true);
}

/** Web producer data retriever
 *  @param {string} aIDCyc - Cycle ID
 *  @returns {Promise<Array>} Producer web sales data
 */
async function wProducersWeb(aIDCyc) {
  const oSQL = `SELECT IDProducer, NameBus, IDMemb,
			SaleNom, FeeCoop, FeeInvt, Ttl,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT
		FROM InvcProducerWeb
		JOIN Producer USING (IDProducer)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE IDCyc = :IDCyc
		ORDER BY NameBus, IDProducer`;
  const oParams = {
    IDCyc: aIDCyc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Onsite producer data retriever
 *  @param {string} aIDCyc - Cycle ID
 *  @param {string} aCdInvcType - Invoice type code
 *  @returns {Promise<Array>} Producer onsite sales data
 */
async function wProducersOnsite(aIDCyc, aCdInvcType) {
  const oSQL = `SELECT IDProducer, NameBus, IDMemb, CdInvcType,
			SaleNom, FeeCoop, FeeInvt, Ttl,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT
		FROM InvcProducerOnsite
		JOIN Producer USING (IDProducer)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE IDCyc = :IDCyc AND CdInvcType = :CdInvcType
		ORDER BY NameBus, IDProducer`;
  const oParams = {
    IDCyc: aIDCyc,
    CdInvcType: aCdInvcType,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
