// shopper-charges.js
// ------------------
// Shopper Charges page controllers

import { wCycFromID, Conn } from "../../Db.js";
import { Fmt_RowExcel } from "../../Util.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, so it must
// be required, though the export is not used:
import _gCSV from "../../CSV.js";

/** Returns the cycle appropriate for the specified request, or displays an
 *  error message, redirects, and returns 'null', if that is not possible. */
async function wCycFromReqOrResp(aReq, aResp) {
  let oCyc;

  if (aReq.params.IDCyc) {
    oCyc = await wCycFromID(aReq.params.IDCyc);
    if (oCyc) return oCyc;

    aResp.status(404);
    aResp.render("Misc/404");
    return null;
  }

  // Can't we use the current cycle if the pickup window has closed, like the
  // Co-op Web Sales By Location page?: [TO DO]
  oCyc = aResp.locals.CycPrev;
  if (oCyc) return oCyc;

  const oMsg = "Cannot compile shopper charges; there is no previous cycle.";
  aResp.Show_Flash("danger", null, oMsg);
  aResp.redirect(303, "/cashier");
  return null;
}

export async function wHandGet(aReq, aResp) {
  const oCyc = await wCycFromReqOrResp(aReq, aResp);
  if (!oCyc) return;

  aResp.locals.Cyc = oCyc;
  aResp.locals.MembsWeb = await wMembsWeb(oCyc.IDCyc);
  aResp.locals.MembsOnsiteRetail = await wMembsOnsite(oCyc.IDCyc, "Retail");
  aResp.locals.MembsOnsiteWholesale = await wMembsOnsite(oCyc.IDCyc, "Wholesale");

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} shopper charges`;
  aResp.render("Cashier/shopper-charges");
}

export async function wHandGetExportWeb(aReq, aResp) {
  const oCyc = await wCycFromReqOrResp(aReq, aResp);
  if (!oCyc) return;

  const oMembs = await wMembsWeb(oCyc.IDCyc);

  for (const oMemb of oMembs) Fmt_RowExcel(oMemb);

  aResp.attachment("Web charges.csv");
  aResp.csv(oMembs, true);
}

export async function wHandGetExportOnsite(aReq, aResp) {
  const oCyc = await wCycFromReqOrResp(aReq, aResp);
  if (!oCyc) return;

  const oMembsRetail = await wMembsOnsite(oCyc.IDCyc, "Retail");
  const oMembsWholesale = await wMembsOnsite(oCyc.IDCyc, "Wholesale");
  const oMembs = [...oMembsRetail, ...oMembsWholesale];

  for (const oMemb of oMembs) Fmt_RowExcel(oMemb);

  aResp.attachment("On-site charges.csv");
  aResp.csv(oMembs, true);
}

async function wMembsWeb(aIDCyc) {
  const oSQL = `SELECT IDMemb, Name1First, Name1Last, NameBus,
			(SaleNomNontaxab + SaleNomTaxab) AS SaleNom,
			(FeeCoopShopNontaxab + FeeCoopShopTaxab) AS FeeCoopShop,
			TaxSale, FeeDelivTransfer, TtlMoney, TtlEBT,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT
		FROM InvcShopWeb
		JOIN Cart USING (IDCart)
		JOIN Memb USING (IDMemb)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE IDCyc = :IDCyc
		ORDER BY Name1Last, Name1First, NameBus, IDMemb`;
  const oParams = {
    IDCyc: aIDCyc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

async function wMembsOnsite(aIDCyc, aCdInvcType) {
  const oSQL = `SELECT IDMemb, Name1First, Name1Last, NameBus, CdInvcType,
			SUM(SaleNomNontaxab + SaleNomTaxab) AS SaleNom,
			SUM(FeeCoopShopNontaxab + FeeCoopShopTaxab) AS FeeCoopShop,
			SUM(TaxSale) AS TaxSale, SUM(TtlMoney) AS TtlMoney, SUM(TtlEBT) AS TtlEBT,
			MAX(IFNULL(zTransact.BalMoney, 0)) AS BalMoney,
			MAX(IFNULL(zTransact.BalEBT, 0)) AS BalEBT
		FROM InvcShopOnsite
		JOIN CartOnsite USING (IDCartOnsite)
		JOIN Memb ON (Memb.IDMemb = CartOnsite.IDMembShop)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE IDCyc = :IDCyc AND InvcShopOnsite.CdInvcType = :CdInvcType
		GROUP BY IDMemb, CdInvcType
		ORDER BY Name1Last, Name1First, NameBus, IDMemb`;
  const oParams = {
    IDCyc: aIDCyc,
    CdInvcType: aCdInvcType,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
