/** Accounting Summary Controllers
 *  @module accounting-summary
 *  @requires Db
 *  @requires Util
 *  @requires Site
 *  @requires CSV
 */

import { Conn } from "../../Db.js";
import { TextIDCyc, TextCurr, TextWhen } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import _gCSV from "../../CSV.js";

/** GET handler for summary page
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Renders accounting summary view
 */
export async function wHandGet(aReq, aResp) {
  // There isn't room to show an entire year without horizontal scrolling:
  aResp.locals.Cycs = await wCycs(6);

  aResp.locals.Title = `${CoopParams.CoopNameShort} accounting summary`;
  aResp.render("Cashier/accounting-summary");
}

/** GET handler for CSV export
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Sends CSV file with accounting data
 */
export async function wHandGetExport(aReq, aResp) {
  /** Row generator helper
   *  @param {string} aProp - Property name
   *  @param {string} aHead - Column header
   */
  function oAdd(aProp, aHead) {
    let oLine = {
      Amt: aHead,
    };
    for (const oCyc of oCycs) {
      const oNameFld = "Cyc" + TextIDCyc(oCyc.IDCyc) + " " + TextWhen(oCyc.WhenEndCyc, "Short");
      // Fmt_RowExcel wouldn't format this, because the field name is actually a
      // date. Is that a mistake?:
      oLine[oNameFld] = TextCurr(oCyc[aProp]);
    }
    oLines.push(oLine);
  }

  const oCycs = await wCycs(12);

  const oLines = [];

  oAdd("FeeMembInit", "Initial member fees assessed");
  oAdd("FeeMembRenew", "Renewal member fees assessed");
  oAdd("RefundFeeMembInit", "Initial member fees refunded");

  oAdd("SaleNomProducerWeb", "Nominal producer web sales");
  oAdd("FeeCoopProducerWeb", "Producer web sale market fees");
  oAdd("FeeInvtProducerWeb", "Producer web sale managed inventory fees");
  oAdd("EarnProducerWeb", "Producer web sale earnings");

  oAdd("SaleNomLostRejectWeb", "Nominal lost or rejected web sales");
  oAdd("SaleNomNontaxabWeb", "Nominal non-taxable shopper web sales");
  oAdd("SaleNomTaxabWeb", "Nominal taxable shopper web sales");
  oAdd("FeeCoopShopWeb", "Shopper web sale market fees");
  oAdd("FeeCoopShopForgivWeb", "Forgiven shopper web sale market fees");
  oAdd("FeeDelivTransferShopWeb", "Shopper web sale delivery/transfer fees");
  oAdd("TaxSaleShopWeb", "Shopper web sale sales tax");
  oAdd("ChargeMoneyShopWeb", "Shopper web sale money charges");
  oAdd("ChargeEBTShopWeb", "Shopper web sale EBT charges");

  oAdd("SaleNomProducerOnsite", "Nominal producer on-site sales");
  oAdd("FeeCoopProducerOnsite", "Producer on-site sale market fees");
  oAdd("FeeInvtProducerOnsite", "Producer on-site sale managed inventory fees");
  oAdd("EarnProducerOnsite", "Producer on-site sale earnings");

  oAdd("SaleNomNontaxabOnsite", "Nominal non-taxable shopper on-site sales");
  oAdd("SaleNomTaxabOnsite", "Nominal taxable shopper on-site sales");
  oAdd("FeeCoopShopOnsite", "Shopper on-site sale market fees");
  oAdd("FeeCoopShopForgivOnsite", "Forgiven shopper on-site sale market fees");
  oAdd("TaxSaleShopOnsite", "Shopper on-site sale sales tax");
  oAdd("ChargeMoneyShopOnsite", "Shopper on-site sale money charges");
  oAdd("ChargeEBTShopOnsite", "Shopper on-site sale EBT charges");

  oAdd("ChargeShopOnsiteMemb", "Member on-site shopper charges");
  oAdd("ChargeShopOnsiteNonmemb", "Non-member on-site shopper charges");

  oAdd("SaleNomProducerOnsiteWholesale", "Nominal producer on-site wholesale sales");
  oAdd("FeeCoopProducerOnsiteWholesale", "Producer on-site wholesale sale market fees");
  oAdd("FeeInvtProducerOnsiteWholesale", "Producer on-site wholesale sale managed inventory fees");
  oAdd("EarnProducerOnsiteWholesale", "Producer on-site wholesale sale earnings");

  oAdd("SaleNomNontaxabOnsiteWholesale", "Nominal non-taxable shopper on-site wholesale sales");
  oAdd("SaleNomTaxabOnsiteWholesale", "Nominal taxable shopper on-site wholesale sales");
  oAdd("FeeCoopShopOnsiteWholesale", "Shopper on-site wholesale sale market fees");
  oAdd("FeeCoopShopForgivOnsiteWholesale", "Forgiven shopper on-site wholesale sale market fees");
  oAdd("TaxSaleShopOnsiteWholesale", "Shopper on-site wholesale sale sales tax");
  oAdd("ChargeMoneyShopOnsiteWholesale", "Shopper on-site wholesale sale money charges");
  oAdd("ChargeEBTShopOnsiteWholesale", "Shopper on-site wholesale sale EBT charges");

  oAdd("ChargeShopOnsiteMembWholesale", "Member on-site wholesale shopper charges");
  oAdd("ChargeShopOnsiteNonmembWholesale", "Non-member on-site wholesale shopper charges");

  aResp.attachment("Accounting summary.csv");
  aResp.csv(oLines, true);
}

/** Cycle summary data retriever
 *  @param {number} aCtMonth - Number of months to include
 *  @returns {Promise<Array>} Cycle summary records
 */
async function wCycs(aCtMonth) {
  const oSQL = `SELECT Cyc.IDCyc, Cyc.WhenEndCyc,
			zTransact.FeeMembInit, zTransact.FeeMembRenew,
			zTransact.RefundFeeMembInit,

			zInvcProducerWeb.SaleNomProducerWeb, zInvcProducerWeb.FeeCoopProducerWeb,
			zInvcProducerWeb.FeeInvtProducerWeb, zInvcProducerWeb.EarnProducerWeb,

			zInvcShopWeb.SaleNomNontaxabWeb, zInvcShopWeb.SaleNomTaxabWeb,
			zInvcShopWeb.FeeCoopShopWeb, zInvcShopWeb.FeeCoopShopForgivWeb,
			zInvcShopWeb.FeeDelivTransferShopWeb, zInvcShopWeb.TaxSaleShopWeb,
			zInvcShopWeb.ChargeMoneyShopWeb, zInvcShopWeb.ChargeEBTShopWeb,

			(
				zInvcProducerWeb.SaleNomProducerWeb
					- zInvcShopWeb.SaleNomNontaxabWeb - zInvcShopWeb.SaleNomTaxabWeb
			) AS SaleNomLostRejectWeb,

			IFNULL(zInvcProducerOnsite.SaleNomProducerOnsite, 0) AS SaleNomProducerOnsite,
			IFNULL(zInvcProducerOnsite.FeeCoopProducerOnsite, 0) AS FeeCoopProducerOnsite,
			IFNULL(zInvcProducerOnsite.FeeInvtProducerOnsite, 0) AS FeeInvtProducerOnsite,
			IFNULL(zInvcProducerOnsite.EarnProducerOnsite, 0) AS EarnProducerOnsite,

			IFNULL(zInvcProducerOnsiteWholesale.SaleNomProducerOnsite, 0) AS SaleNomProducerOnsiteWholesale,
			IFNULL(zInvcProducerOnsiteWholesale.FeeCoopProducerOnsite, 0) AS FeeCoopProducerOnsiteWholesale,
			IFNULL(zInvcProducerOnsiteWholesale.FeeInvtProducerOnsite, 0) AS FeeInvtProducerOnsiteWholesale,
			IFNULL(zInvcProducerOnsiteWholesale.EarnProducerOnsite, 0) AS EarnProducerOnsiteWholesale,

			IFNULL(zInvcShopOnsite.SaleNomNontaxabOnsite, 0) AS SaleNomNontaxabOnsite,
			IFNULL(zInvcShopOnsite.SaleNomTaxabOnsite, 0) AS SaleNomTaxabOnsite,
			IFNULL(zInvcShopOnsite.FeeCoopShopOnsite, 0) AS FeeCoopShopOnsite,
			IFNULL(zInvcShopOnsite.FeeCoopShopForgivOnsite, 0) AS FeeCoopShopForgivOnsite,
			IFNULL(zInvcShopOnsite.TaxSaleShopOnsite, 0) AS TaxSaleShopOnsite,
			IFNULL(zInvcShopOnsite.ChargeMoneyShopOnsite, 0) AS ChargeMoneyShopOnsite,
			IFNULL(zInvcShopOnsite.ChargeEBTShopOnsite, 0) AS ChargeEBTShopOnsite,
			IFNULL(zInvcShopOnsite.ChargeShopOnsiteMemb, 0) AS ChargeShopOnsiteMemb,
			IFNULL(zInvcShopOnsite.ChargeShopOnsiteNonmemb, 0) AS ChargeShopOnsiteNonmemb,

			IFNULL(zInvcShopOnsiteWholesale.SaleNomNontaxabOnsite, 0) AS SaleNomNontaxabOnsiteWholesale,
			IFNULL(zInvcShopOnsiteWholesale.SaleNomTaxabOnsite, 0) AS SaleNomTaxabOnsiteWholesale,
			IFNULL(zInvcShopOnsiteWholesale.FeeCoopShopOnsite, 0) AS FeeCoopShopOnsiteWholesale,
			IFNULL(zInvcShopOnsiteWholesale.FeeCoopShopForgivOnsite, 0) AS FeeCoopShopForgivOnsiteWholesale,
			IFNULL(zInvcShopOnsiteWholesale.TaxSaleShopOnsite, 0) AS TaxSaleShopOnsiteWholesale,
			IFNULL(zInvcShopOnsiteWholesale.ChargeMoneyShopOnsite, 0) AS ChargeMoneyShopOnsiteWholesale,
			IFNULL(zInvcShopOnsiteWholesale.ChargeEBTShopOnsite, 0) AS ChargeEBTShopOnsiteWholesale,
			IFNULL(zInvcShopOnsiteWholesale.ChargeShopOnsiteMemb, 0) AS ChargeShopOnsiteMembWholesale,
			IFNULL(zInvcShopOnsiteWholesale.ChargeShopOnsiteNonmemb, 0) AS ChargeShopOnsiteNonmembWholesale
		FROM Cyc
		JOIN (
			SELECT Cyc.IDCyc,
				IFNULL(SUM(
					IF(Transact.CdTypeTransact = 'FeeMembInit', Transact.AmtMoney, 0)
				), 0) AS FeeMembInit,
				IFNULL(SUM(
					IF(Transact.CdTypeTransact = 'FeeMembRenew', Transact.AmtMoney, 0)
				), 0) AS FeeMembRenew,
				IFNULL(SUM(
					IF(Transact.CdTypeTransact = 'RefundFeeMembInit', -Transact.AmtMoney, 0)
				), 0) AS RefundFeeMembInit
			FROM Cyc
			LEFT JOIN Transact ON (Transact.WhenCreate >= Cyc.WhenStartCyc)
				AND (Transact.WhenCreate < Cyc.WhenEndCyc)
			GROUP BY IDCyc
		) AS zTransact USING (IDCyc)
		JOIN (
			SELECT Cyc.IDCyc,
				IFNULL(SUM(InvcProducerWeb.SaleNom), 0) AS SaleNomProducerWeb,
				IFNULL(SUM(InvcProducerWeb.FeeCoop), 0) AS FeeCoopProducerWeb,
				IFNULL(SUM(InvcProducerWeb.FeeInvt), 0) AS FeeInvtProducerWeb,
				IFNULL(SUM(InvcProducerWeb.Ttl), 0) AS EarnProducerWeb
			FROM Cyc
			LEFT JOIN InvcProducerWeb USING (IDCyc)
			GROUP BY IDCyc
		) AS zInvcProducerWeb USING (IDCyc)
		JOIN (
			SELECT Cyc.IDCyc,
				IFNULL(SUM(InvcShopWeb.SaleNomNontaxab), 0) AS SaleNomNontaxabWeb,
				IFNULL(SUM(InvcShopWeb.SaleNomTaxab), 0) AS SaleNomTaxabWeb,
				IFNULL(SUM(
					InvcShopWeb.FeeCoopShopNontaxab + InvcShopWeb.FeeCoopShopTaxab
				), 0) AS FeeCoopShopWeb,
				IFNULL(SUM(InvcShopWeb.FeeCoopShopForgiv), 0) AS FeeCoopShopForgivWeb,
				IFNULL(SUM(InvcShopWeb.FeeDelivTransfer), 0) AS FeeDelivTransferShopWeb,
				IFNULL(SUM(InvcShopWeb.TaxSale), 0) AS TaxSaleShopWeb,
				IFNULL(SUM(InvcShopWeb.TtlMoney), 0) AS ChargeMoneyShopWeb,
				IFNULL(SUM(InvcShopWeb.TtlEBT), 0) AS ChargeEBTShopWeb
			FROM Cyc
			LEFT JOIN Cart USING (IDCyc)
			LEFT JOIN InvcShopWeb USING (IDCart)
			GROUP BY IDCyc
		) AS zInvcShopWeb USING (IDCyc)
		LEFT JOIN (
			SELECT Cyc.IDCyc,
				IFNULL(SUM(InvcProducerOnsite.SaleNom), 0) AS SaleNomProducerOnsite,
				IFNULL(SUM(InvcProducerOnsite.FeeCoop), 0) AS FeeCoopProducerOnsite,
				IFNULL(SUM(InvcProducerOnsite.FeeInvt), 0) AS FeeInvtProducerOnsite,
				IFNULL(SUM(InvcProducerOnsite.Ttl), 0) AS EarnProducerOnsite
			FROM Cyc
			LEFT JOIN InvcProducerOnsite USING (IDCyc)
			WHERE InvcProducerOnsite.CdInvcType = 'Retail' AND InvcProducerOnsite.CdInvcType = 'Retail'
			GROUP BY IDCyc
		) AS zInvcProducerOnsite USING (IDCyc)
		LEFT JOIN (
			SELECT Cyc.IDCyc,
				IFNULL(SUM(InvcProducerOnsite.SaleNom), 0) AS SaleNomProducerOnsite,
				IFNULL(SUM(InvcProducerOnsite.FeeCoop), 0) AS FeeCoopProducerOnsite,
				IFNULL(SUM(InvcProducerOnsite.FeeInvt), 0) AS FeeInvtProducerOnsite,
				IFNULL(SUM(InvcProducerOnsite.Ttl), 0) AS EarnProducerOnsite
			FROM Cyc
			LEFT JOIN InvcProducerOnsite USING (IDCyc)
			WHERE InvcProducerOnsite.CdInvcType = 'Wholesale' AND InvcProducerOnsite.CdInvcType = 'Wholesale'
			GROUP BY IDCyc
		) AS zInvcProducerOnsiteWholesale USING (IDCyc)
		LEFT JOIN (
			SELECT Cyc.IDCyc,
				IFNULL(SUM(InvcShopOnsite.SaleNomNontaxab), 0) AS SaleNomNontaxabOnsite,
				IFNULL(SUM(InvcShopOnsite.SaleNomTaxab), 0) AS SaleNomTaxabOnsite,
				IFNULL(SUM(
					InvcShopOnsite.FeeCoopShopNontaxab + InvcShopOnsite.FeeCoopShopTaxab
				), 0) AS FeeCoopShopOnsite,
				IFNULL(SUM(InvcShopOnsite.FeeCoopShopForgiv), 0)
					AS FeeCoopShopForgivOnsite,
				IFNULL(SUM(InvcShopOnsite.TaxSale), 0) AS TaxSaleShopOnsite,
				IFNULL(SUM(InvcShopOnsite.TtlMoney), 0) AS ChargeMoneyShopOnsite,
				IFNULL(SUM(InvcShopOnsite.TtlEBT), 0) AS ChargeEBTShopOnsite,
				IFNULL(SUM(
					IF(CartOnsite.IDMembShop IS NULL, 0, InvcShopOnsite.Ttl)
				), 0) AS ChargeShopOnsiteMemb,
				IFNULL(SUM(
					IF(CartOnsite.IDMembShop IS NULL, InvcShopOnsite.Ttl, 0)
				), 0) AS ChargeShopOnsiteNonmemb
			FROM Cyc
			LEFT JOIN CartOnsite USING (IDCyc)
			LEFT JOIN InvcShopOnsite USING (IDCartOnsite)
			WHERE InvcShopOnsite.CdInvcType = 'Retail' AND CartOnsite.CdCartType = 'Retail'
			GROUP BY IDCyc
		) AS zInvcShopOnsite USING (IDCyc)
		LEFT JOIN (
			SELECT Cyc.IDCyc,
				IFNULL(SUM(InvcShopOnsite.SaleNomNontaxab), 0) AS SaleNomNontaxabOnsite,
				IFNULL(SUM(InvcShopOnsite.SaleNomTaxab), 0) AS SaleNomTaxabOnsite,
				IFNULL(SUM(
					InvcShopOnsite.FeeCoopShopNontaxab + InvcShopOnsite.FeeCoopShopTaxab
				), 0) AS FeeCoopShopOnsite,
				IFNULL(SUM(InvcShopOnsite.FeeCoopShopForgiv), 0)
					AS FeeCoopShopForgivOnsite,
				IFNULL(SUM(InvcShopOnsite.TaxSale), 0) AS TaxSaleShopOnsite,
				IFNULL(SUM(InvcShopOnsite.TtlMoney), 0) AS ChargeMoneyShopOnsite,
				IFNULL(SUM(InvcShopOnsite.TtlEBT), 0) AS ChargeEBTShopOnsite,
				IFNULL(SUM(
					IF(CartOnsite.IDMembShop IS NULL, 0, InvcShopOnsite.Ttl)
				), 0) AS ChargeShopOnsiteMemb,
				IFNULL(SUM(
					IF(CartOnsite.IDMembShop IS NULL, InvcShopOnsite.Ttl, 0)
				), 0) AS ChargeShopOnsiteNonmemb
			FROM Cyc
			LEFT JOIN CartOnsite USING (IDCyc)
			LEFT JOIN InvcShopOnsite USING (IDCartOnsite)
			WHERE InvcShopOnsite.CdInvcType = 'Wholesale' AND CartOnsite.CdCartType = 'Wholesale'
			GROUP BY IDCyc
		) AS zInvcShopOnsiteWholesale USING (IDCyc)
		WHERE (
			Cyc.WhenEndCyc > DATE_SUB(NOW(), INTERVAL :CtMonth MONTH)
			AND Cyc.WhenEndCyc < NOW()
		)
		ORDER BY IDCyc`;
  const oParams = {
    CtMonth: aCtMonth,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
