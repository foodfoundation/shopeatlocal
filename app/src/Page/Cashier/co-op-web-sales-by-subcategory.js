// co-op-web-sales-by-subcategory.js
// ---------------------------------
// Web Sales Subcategory Analysis Controllers
// @module co-op-web-sales-by-subcategory
// @requires Db
// @requires Util
// @requires Site
// @requires CSV

import { Conn, wCycsByEndPickup } from "../../Db.js";
import { TextIDCyc, TextCurr, Fmt_RowExcel } from "../../Util.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, so it must
// be required, though the export is not used:
import _gCSV from "../../CSV.js";

/** GET handler for subcategory analysis view
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Renders subcategory analysis interface
 */
export async function wHandGet(aReq, aResp) {
  const [oCycs, oSubcats] = await wCycsSubcats(6);
  aResp.locals.Cycs = oCycs;
  aResp.locals.Subcats = oSubcats;

  aResp.locals.Title = `${CoopParams.CoopNameShort} market web sales by subcategory`;
  aResp.render("Cashier/co-op-web-sales-by-subcategory");
}

/** Quantity export handler
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Exports quantity data as CSV
 */
export async function wHandGetExportQtySold(aReq, aResp) {
  await wHandGetExport(aReq, aResp, "QtySold");
}

/** Sales export handler
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Exports sales data as CSV
 */
export async function wHandGetExportSaleNom(aReq, aResp) {
  await wHandGetExport(aReq, aResp, "SaleNom");
}

async function wHandGetExport(aReq, aResp, aPropSales) {
  const [oCycs, oSubcats] = await wCycsSubcats(12);

  const oLines = [];
  for (const oSubcat of oSubcats) {
    const oLine = {
      IDCat: oSubcat.IDCat,
      NameCat: oSubcat.NameCat,
      IDSubcat: oSubcat.IDSubcat,
      NameSubcat: oSubcat.NameSubcat,
    };

    for (const oCyc of oCycs) {
      const oNameFld = "Cyc" + TextIDCyc(oCyc.IDCyc);
      //
      // Or use the date?:
      //
      // // This will be part of the heading, which is not covered by Fmt_RowExcel:
      // const oNameFld = gUtil.TextDateExcel(oCyc.WhenEndPickup);

      const oData = oSubcat.CycsByID[oCyc.IDCyc];
      let oTextFld = (oData && oData[aPropSales]) || 0;
      // Fmt_RowExcel won't do this, because the field name is actually a date.
      // Is that a mistake?:
      if (aPropSales.startsWith("Sale")) oTextFld = TextCurr(oTextFld);

      oLine[oNameFld] = oTextFld;
    }

    Fmt_RowExcel(oLine);
    oLines.push(oLine);
  }

  let oTextVar;
  switch (aPropSales) {
    case "QtySold":
      oTextVar = "quantity sold";
      break;
    case "SaleNom":
      oTextVar = "nominal sales";
      break;
    default:
      oTextVar = "UNKNOWN";
      break;
  }

  aResp.attachment(`Market web sales (${oTextVar}).csv`);
  aResp.csv(oLines, true);
}

/** Sales data aggregator
 *  @param {number} aCtMonth - Number of months to analyze
 *  @returns {Promise<Object>} Aggregated sales data by cycle and subcategory
 */
async function wSalesBySubcatCyc(aCtMonth) {
  const oSQL = `SELECT Subcat.IDSubcat, Subcat.NameSubcat,
			Cat.IDCat, Cat.NameCat,
			SUM(ItCart.QtySold) AS QtySold, SUM(ItCart.SaleNom) AS SaleNom,
			Cyc.IDCyc
		FROM Subcat
		JOIN Cat USING (IDCat)
		JOIN Product USING (IDSubcat)
		JOIN Vty USING (IDProduct)
		LEFT JOIN ItCart USING (IDVty)
		LEFT JOIN Cart USING (IDCart)
		LEFT JOIN Cyc USING (IDCyc)
		WHERE (Cyc.WhenEndPickup IS NULL)
			OR (
				Cyc.WhenEndPickup > DATE_SUB(NOW(), INTERVAL :CtMonth MONTH)
				AND Cyc.WhenEndPickup < NOW()
			)
		GROUP BY IDSubcat, IDCyc
		ORDER BY IDCat, IDSubcat`;
  const oParams = {
    CtMonth: aCtMonth,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Data retrieval utility
 *  @param {number} aCtMonth - Number of months to analyze
 *  @returns {Promise<Array>} [cycles, subcategories] with sales data
 */
async function wCycsSubcats(aCtMonth) {
  const oSalesBySubcatCyc = await wSalesBySubcatCyc(aCtMonth);

  // Structure sales data by subcategory
  // -----------------------------------

  const oSubcats = [];
  let oSubcatLast = null;
  for (const oSale of oSalesBySubcatCyc) {
    if (!oSubcatLast || oSale.IDSubcat !== oSubcatLast.IDSubcat) {
      oSubcatLast = {
        IDCat: oSale.IDCat,
        NameCat: oSale.NameCat,
        IDSubcat: oSale.IDSubcat,
        NameSubcat: oSale.NameSubcat,
        CycsByID: {},
      };
      oSubcats.push(oSubcatLast);
    }

    if (oSale.IDCyc) {
      oSubcatLast.CycsByID[oSale.IDCyc] = {
        QtySold: oSale.QtySold,
        SaleNom: oSale.SaleNom,
      };
    }
  }

  // Fill cycle arrays
  // -----------------
  // The cycle data was stored in CycsByID to support lookups by ID. Now it is
  // converted to an array for use in the view.

  // Get cycles after sales data on the remote chance that the time limit for
  // the oldest cycle is crossed between the queries. This will prevent that
  // first cycle from appearing to be empty:
  const oCycs = await wCycsByEndPickup(aCtMonth);

  for (const oSubcat of oSubcats) {
    oSubcat.Cycs = [];
    for (const oCyc of oCycs) {
      const oData = oSubcat.CycsByID[oCyc.IDCyc] || { QtySold: 0, SaleNom: 0 };
      oSubcat.Cycs.push(oData);
    }
  }

  return [oCycs, oSubcats];
}
