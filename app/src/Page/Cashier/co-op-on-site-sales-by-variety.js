/** On-site Sales Analysis Controllers
 *  @module co-op-on-site-sales-by-variety
 *  @requires Db
 *  @requires Util
 *  @requires Site
 *  @requires CSV
 */

import { Conn, wCycsByEndCyc } from "../../Db.js";
import { TextIDCyc, TextCurr, Fmt_RowExcel } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import _gCSV from "../../CSV.js";

/** GET handler for sales analysis view
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Renders sales analysis interface
 */
export async function wHandGet(aReq, aResp) {
  const [oCycs, oVtys] = await wCycsVtys(6);
  aResp.locals.Cycs = oCycs;
  aResp.locals.Vtys = oVtys;
  aResp.locals.Title = `${CoopParams.CoopNameShort} market on-site sales by variety`;
  aResp.render("Cashier/co-op-on-site-sales-by-variety");
}

/** Quantity export handler
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Exports quantity data as CSV
 */
export async function wHandGetExportQty(aReq, aResp) {
  await wHandGetExport(aReq, aResp, "Qty");
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
  const [oCycs, oVtys] = await wCycsVtys(12);

  const oLines = [];
  for (const oVty of oVtys) {
    const oLine = {
      IDProducer: oVty.IDProducer,
      NameBus: oVty.NameBus,
      IDProduct: oVty.IDProduct,
      NameProduct: oVty.NameProduct,
      IDVty: oVty.IDVty,
      Kind: oVty.Kind,
      Size: oVty.Size,
      WgtMin: oVty.WgtMin,
      WgtMax: oVty.WgtMax,
    };

    for (const oCyc of oCycs) {
      const oNameFld = "Cyc" + TextIDCyc(oCyc.IDCyc);
      //
      // Or use the date?:
      //
      // // This will be part of the heading, which is not covered by Fmt_RowExcel:
      // const oNameFld = gUtil.TextDateExcel(oCyc.WhenEndCyc);

      const oData = oVty.CycsByID[oCyc.IDCyc];
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
    case "Qty":
      oTextVar = "quantity";
      break;
    case "SaleNom":
      oTextVar = "nominal sales";
      break;
    default:
      oTextVar = "UNKNOWN";
      break;
  }

  aResp.attachment(`Market on-site sales (${oTextVar}).csv`);
  aResp.csv(oLines, true);
}

/** Sales data aggregator
 *  @param {number} aCtMonth - Number of months to analyze
 *  @returns {Promise<Object>} Aggregated sales data by cycle and variety
 */
async function wSalesByVtyCyc(aCtMonth) {
  const oSQL = `SELECT Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkListOnsite,
			Product.IDProduct, Product.NameProduct,
			Producer.IDProducer, Producer.NameBus,
			IFNULL(SUM(ItCartOnsite.Qty), 0) AS Qty,
			IFNULL(SUM(ItCartOnsite.SaleNom), 0) AS SaleNom,
			CartOnsite.IDCyc,
			Cyc.WhenEndCyc
		FROM Vty
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		LEFT JOIN ItCartOnsite USING (IDVty)
		LEFT JOIN CartOnsite USING (IDCartOnsite)
		LEFT JOIN Cyc USING (IDCyc)
		WHERE (Vty.CkListOnsite IS TRUE)
			OR (Cyc.WhenEndCyc IS NOT NULL
				AND (Cyc.WhenEndCyc > DATE_SUB(NOW(), INTERVAL :CtMonth MONTH))
				AND (Cyc.WhenEndCyc < NOW())
			)
		GROUP BY Vty.IDVty, CartOnsite.IDCyc
		ORDER BY Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    CtMonth: aCtMonth,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Data retrieval utility
 *  @param {number} aCtMonth - Number of months to analyze
 *  @returns {Promise<Array>} [cycles, varieties] with sales data
 */
async function wCycsVtys(aCtMonth) {
  const oSalesByVtyCyc = await wSalesByVtyCyc(aCtMonth);

  // Structure sales data by variety
  // -------------------------------

  const oVtys = [];
  let oVtyLast = null;
  for (const oSale of oSalesByVtyCyc) {
    if (!oVtyLast || oSale.IDVty !== oVtyLast.IDVty) {
      oVtyLast = {
        IDVty: oSale.IDVty,
        Kind: oSale.Kind,
        Size: oSale.Size,
        WgtMin: oSale.WgtMin,
        WgtMax: oSale.WgtMax,
        CkListOnsite: oSale.CkListOnsite,
        IDProduct: oSale.IDProduct,
        NameProduct: oSale.NameProduct,
        IDProducer: oSale.IDProducer,
        NameBus: oSale.NameBus,
        CycsByID: {},
      };
      oVtys.push(oVtyLast);
    }

    if (oSale.IDCyc) {
      oVtyLast.CycsByID[oSale.IDCyc] = {
        Qty: oSale.Qty,
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
  const oCycs = await wCycsByEndCyc(aCtMonth);

  for (const oVty of oVtys) {
    oVty.Cycs = [];
    for (const oCyc of oCycs) {
      const oData = oVty.CycsByID[oCyc.IDCyc] || { QtySold: 0, SaleNom: 0 };
      oVty.Cycs.push(oData);
    }
  }

  return [oCycs, oVtys];
}
