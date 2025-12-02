// producer-web-sales-by-variety.js
// --------------------------------
// Producer Web Sales By Variety page controllers

import { wProducerFromID, Conn } from "../../Db.js";
import { TextIDCyc, TextCurr, Fmt_RowExcel } from "../../Util.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, so it must
// be required, though the export is not used:
import _gCSV from "../../CSV.js";

export async function wHandGet(aReq, aResp) {
  // The optional URL parameter allows a specific producer to be selected, but
  // only staff can use that parameter, so I guess there is no need to worry
  // about a producer viewing another producer's data.

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  const [oSales, oCycs] = await wSalesCycs(oIDProducer, 6);
  aResp.locals.Sales = oSales;
  aResp.locals.Cycs = oCycs;

  const oPathExportQty = "/producer-web-sales-by-variety-export-quantities";
  aResp.locals.PathExportQty = aReq.params.IDProducerSel
    ? oPathExportQty + "/" + oIDProducer
    : oPathExportQty;

  const oPathExportSale = "/producer-web-sales-by-variety-export-sales";
  aResp.locals.PathExportSale = aReq.params.IDProducerSel
    ? oPathExportSale + "/" + oIDProducer
    : oPathExportSale;

  aResp.locals.Title = aReq.t("common:pageTitles.producerWebSalesByVariety", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("Producer/producer-web-sales-by-variety");
}

export async function wHandGetExportQtyDeliv(aReq, aResp) {
  await wHandGetExport(aReq, aResp, "QtyDeliv");
}

export async function wHandGetExportSaleNom(aReq, aResp) {
  await wHandGetExport(aReq, aResp, "SaleNom");
}

async function wHandGetExport(aReq, aResp, aPropSales) {
  // Staff users can select a producer when using this page. Non-staff users
  // cannot:
  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  const [oSales, oCycs] = await wSalesCycs(oIDProducer, 12);

  const oLines = [];
  for (const oSale of oSales) {
    const oLine = {
      IDProduct: oSale.IDProduct,
      NameProduct: oSale.NameProduct,
      IDVty: oSale.IDVty,
      Kind: oSale.Kind,
      Size: oSale.Size,
      WgtMin: oSale.WgtMin,
      WgtMax: oSale.WgtMax,
      CkListWeb: oSale.CkListWeb,
      CkListOnsite: oSale.CkListOnsite,
    };

    for (const oCyc of oCycs) {
      const oNameFld = "Cyc" + TextIDCyc(oCyc.IDCyc);
      //
      // Or use the date?:
      //
      // // This will be part of the heading, which is not covered by Fmt_RowExcel:
      // const oNameFld = gUtil.TextDateExcel(oCyc.WhenEndDeliv);

      const oData = oSale.CycsByID[oCyc.IDCyc];
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
    case "QtyDeliv":
      oTextVar = aReq.t("common:producerWebSales.quantityDelivered");
      break;
    case "SaleNom":
      oTextVar = aReq.t("common:producerWebSales.nominalSales");
      break;
    default:
      oTextVar = "UNKNOWN";
      break;
  }

  aResp.attachment(aReq.t("common:exportFilenames.producerWebSales", { type: oTextVar }) + ".csv");
  aResp.csv(oLines, true);
}

/** Returns the specified producer's delivery quantities and amounts, by cycle
 *  and variety, over the last year. */
async function wSalesByVtyCyc(aIDProducer, aCtMonth) {
  const oSQL = `SELECT Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkListWeb, Vty.CkListOnsite,
			Product.IDProduct, Product.NameProduct,
			SUM(ItDeliv.QtyDeliv) AS QtyDeliv,
			SUM(ItDeliv.SaleNom) AS SaleNom, SUM(ItDeliv.FeeCoop) AS FeeCoop,
			Cyc.IDCyc
		FROM Vty
		JOIN Product USING (IDProduct)
		LEFT JOIN ItDeliv USING (IDVty)
		LEFT JOIN Cyc USING (IDCyc)
		WHERE Product.IDProducer = :IDProducer
			AND (
				(Cyc.WhenEndDeliv IS NULL)
				OR (
					Cyc.WhenEndDeliv >= DATE_SUB(NOW(), INTERVAL :CtMonth MONTH)
					AND Cyc.WhenEndDeliv < NOW()
				)
			)
		GROUP BY IDVty, IDCyc
		ORDER BY IDProduct, IDVty`;
  const oParams = {
    IDProducer: aIDProducer,
    CtMonth: aCtMonth,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Returns cycles within the specified month count. */
async function wCycs(aCtMonth) {
  const oSQL = `SELECT IDCyc, Cyc.WhenEndDeliv
		FROM Cyc
		WHERE Cyc.WhenEndDeliv >= DATE_SUB(NOW(), INTERVAL :CtMonth MONTH)
			AND Cyc.WhenEndDeliv < NOW()
		ORDER BY IDCyc`;
  const oParams = {
    CtMonth: aCtMonth,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Returns an array containing the specified producer's sales, and the cycles
 *  over which the sales were compiled. Each sales record contains product and
 *  variety data, plus a Cycs array with sales data elements that correspond to
 *  the top-level cycles array returned by this function. */
async function wSalesCycs(aIDProducer, aCtMonth) {
  const oSalesByVtyCyc = await wSalesByVtyCyc(aIDProducer, aCtMonth);

  // Collect sales data by cycle
  // ---------------------------

  const oSales = [];
  let oVtyLast = null;
  for (const oSale of oSalesByVtyCyc) {
    if (!oSale.CkListWeb && oSale.QtyDeliv < 1) continue;

    if (!oVtyLast || oSale.IDVty !== oVtyLast.IDVty) {
      oVtyLast = {
        IDProduct: oSale.IDProduct,
        NameProduct: oSale.NameProduct,
        IDVty: oSale.IDVty,
        Kind: oSale.Kind,
        Size: oSale.Size,
        WgtMin: oSale.WgtMin,
        WgtMax: oSale.WgtMax,
        CkListWeb: oSale.CkListWeb,
        CkListOnsite: oSale.CkListOnsite,
        CycsByID: {},
      };
      oSales.push(oVtyLast);
    }

    if (oSale.IDCyc) {
      oVtyLast.CycsByID[oSale.IDCyc] = {
        QtyDeliv: oSale.QtyDeliv,
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
  const oCycs = await wCycs(aCtMonth);

  for (const oSale of oSales) {
    oSale.Cycs = [];
    for (const oCyc of oCycs) {
      const oData = oSale.CycsByID[oCyc.IDCyc] || { QtyDeliv: 0, SaleNom: 0 };
      oSale.Cycs.push(oData);
    }
  }

  return [oSales, oCycs];
}
