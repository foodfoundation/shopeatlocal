// InvcProducerWeb.js
// ------------------
// Web producer invoice generation

import gAsstPDF from "./AsstPDF.js";
import { Wth, Data } from "./SVGLogoTextGrey.js";
import { wMembFromID, getProductRow } from "./Db.js";
import {
  NameRndAlphaNum,
  TextIDInvcProducerWeb,
  TextIDCyc,
  TextIDProducer,
  TextWhen,
  TextIDProduct,
  TextIDVty,
  NameVty,
  TextCurr,
  TextWgt,
} from "./Util.js";
import { CoopParams, Site } from "./Site.js";
import { LenNameFileStoreDoc } from "../Cfg.js";
import { Storage } from "./Storage.js";
import { PassThrough } from "stream";

import gPDFKit from "pdfkit";
import gSVGPDFKit from "svg-to-pdfkit";

import _ from "lodash";
const { round } = _;

/** Manages producer web invoice lifecycle
 *  @param {Connection} aConn - Database connection with active transaction
 *  @param {Object} aCyc - Cycle data object
 *  @param {Object} aProducer - Producer data object
 *  @returns {number|undefined} Invoice ID if newly created
 *  @throws {Error} If PDF generation or storage fails
 *  @note Transaction rollback required on error to maintain data consistency
 */
export async function wCreate(aConn, aCyc, aProducer) {
  const oMemb = await wMembFromID(aProducer.IDMemb, aConn);
  const oData = await wDataInvc(aCyc.IDCyc, aProducer.IDProducer, aConn);

  // This must be done before the file is created, so that the invoice number
  // can be displayed in the invoice:
  const oNameFile = NameRndAlphaNum(LenNameFileStoreDoc) + ".pdf";
  const oIDInvc = await wUpsert_Invc(aCyc.IDCyc, aProducer.IDProducer, oNameFile, oData, aConn);

  // Create document
  // ---------------

  const oOptsPage = {
    margin: 0,
    autoFirstPage: false,
  };
  const oDoc = new gPDFKit(oOptsPage);

  const oPassThrough = new PassThrough();
  oDoc.pipe(oPassThrough);

  const oOptsAsst = {};
  const oAsst = gAsstPDF(oDoc, oOptsAsst);

  // Add footer
  // ----------

  const oIDTextInvc = TextIDInvcProducerWeb(oIDInvc);

  // The current page number. PDFKit doesn't seem to publish this, unbelievable
  // as that sounds:
  let oNumPage = 0;

  const oRend_Footer = function () {
    ++oNumPage;

    const host = new URL(CoopParams.HomeWebsite).host;

    oAsst.Footer("Web producer invoice " + oIDTextInvc, host, "Page " + oNumPage);
  };

  oDoc.on("pageAdded", oRend_Footer);
  oDoc.addPage();

  // Render content
  // --------------

  const oSizeFontHead = 24;
  const oSizeFontMain = 11;
  const oSizeFontVty = 9;

  oAsst.Set_NameFont("Helvetica-Bold");
  oAsst.Set_SizeFont(oSizeFontHead);
  oAsst.Set_ColorFill("#888");
  oAsst.WriteLine("WEB PRODUCER INVOICE");

  const oX = 8.0 * 72 - Wth;
  const oY = 0.5 * 72 + 3;
  gSVGPDFKit(oDoc, Data, oX, oY, {});

  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Next(0.25);

  oDoc
    .lineWidth(0.5)
    .strokeColor("#888")
    .moveTo(oAsst.MargLeft, oAsst.Y)
    .lineTo(oAsst.BoundRight, oAsst.Y)
    .stroke();

  oAsst.Next(0.33);

  // ID table labels
  // ···············

  oAsst.Y += 3;

  let oTopTbl = oAsst.Y;
  let oWthColLbl = 0;

  oAsst.Set_NameFont("Helvetica-Bold");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("#888");

  let oSize = oAsst.WriteLine("Invoice ID");
  oWthColLbl = Math.max(oWthColLbl, oSize.Wth);

  oSize = oAsst.WriteLine("Cycle ID");
  oWthColLbl = Math.max(oWthColLbl, oSize.Wth);

  oSize = oAsst.WriteLine("Producer ID");
  oWthColLbl = Math.max(oWthColLbl, oSize.Wth);

  oSize = oAsst.WriteLine("Invoice time");
  oWthColLbl = Math.max(oWthColLbl, oSize.Wth);

  let oBtmTbl = oAsst.Y;

  // ID table values
  // ···············

  oAsst.X += oWthColLbl + oSizeFontMain;
  oAsst.Y = oTopTbl;

  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  oAsst.WriteLine(oIDTextInvc);

  let oText = TextIDCyc(aCyc.IDCyc);
  oAsst.WriteLine(oText);

  oText = TextIDProducer(aProducer.IDProducer);
  oAsst.WriteLine(oText);

  const oNow = new Date();
  oText = TextWhen(oNow, "FullMed", "HourMinSec");
  oAsst.WriteLine(oText);

  // Producer table
  // ··············

  oAsst.Set_NameFont("Helvetica-Bold");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  const oOptsProducer = {
    width: 3.75 * 72,
    height: oSizeFontMain,
    ellipsis: true,
    align: "right",
  };

  oAsst.X = 4.25 * 72;
  oAsst.Y = oTopTbl;

  oAsst.WriteLine(aProducer.NameBus, oOptsProducer);

  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  oText = oMemb.Name1First + " " + oMemb.Name1Last;
  oAsst.WriteLine(oText, oOptsProducer);

  oAsst.WriteLine(aProducer.Addr1, oOptsProducer);

  if (aProducer.Addr2) oAsst.WriteLine(aProducer.Addr2, oOptsProducer);

  oText = aProducer.City + ", " + aProducer.St + " " + aProducer.Zip;
  oAsst.WriteLine(oText, oOptsProducer);

  oBtmTbl = Math.max(oBtmTbl, oAsst.Y);
  oAsst.Y = oBtmTbl;

  // Products
  // ········

  const oHgtHeadVty = oSizeFontHead;

  for (const oProduct of oData.Products) {
    oAsst.X = oAsst.MargLeft;
    oAsst.Y += oSizeFontMain;

    oAsst.Set_NameFont("Helvetica-Bold");
    oAsst.Set_SizeFont(oSizeFontMain);
    oAsst.Set_ColorFill("black");

    const oHgtHeadProduct = oAsst.HgtLine() * 2 + oHgtHeadVty + oSizeFontVty * 1.5;
    oAsst.CkAddPage(oHgtHeadProduct);

    oText = "PRODUCT " + TextIDProduct(oProduct.IDProduct) + ": " + oProduct.NameProduct;
    oAsst.WriteLine(oText);

    // Varieties
    // ·········

    const oOptsNameVty = {
      width: 3 * 72,
      height: oSizeFontVty,
      ellipsis: true,
    };
    const oOptsValVty = {
      width: (4.5 / 8) * 72,
      align: "right",
    };

    const oOptsHeadNameVty = {
      width: oOptsNameVty.width,
      lineBreak: true,
      baseline: "top",
    };
    const oOptsHeadValVty = {
      ...oOptsValVty,
      lineBreak: true,
      baseline: "top",
    };

    // Variety records
    // ···············

    oAsst.Set_SizeFont(oSizeFontVty);
    oAsst.ScaleLine = 1.4;

    for (let oIdxVty = 0; oIdxVty < oProduct.Vtys.length; ++oIdxVty) {
      const oVty = oProduct.Vtys[oIdxVty];

      // Variety heading
      // ···············

      const oCkHead = !oIdxVty || oAsst.CkAddPage(oAsst.HgtLine());
      if (oCkHead) {
        oAsst.Set_NameFont("Helvetica-Bold");
        oAsst.Set_SizeFont(oSizeFontVty);
        oAsst.Set_ColorFill("black");
        oAsst.Return();

        oAsst.Write("\nVariety", oOptsHeadNameVty);
        oAsst.Write("\nPrice", oOptsHeadValVty);
        oAsst.Write("Qty\nProm", oOptsHeadValVty);
        oAsst.Write("Qty\nDeliv", oOptsHeadValVty);
        oAsst.Write("Wgt\nDeliv", oOptsHeadValVty);
        oAsst.Write("\nSales", oOptsHeadValVty);
        oAsst.Write("Market\nfees", oOptsHeadValVty);
        oAsst.Write("Invent\nfees", oOptsHeadValVty);
        oAsst.Write("\nSubtot", oOptsHeadValVty);

        oAsst.Y += oHgtHeadVty;
      }

      // Alternating grey background
      // ···························

      if (!(oIdxVty % 2)) {
        oAsst.Set_ColorFill("#E0E0E0");
        oDoc.rect(oAsst.MargLeft, oAsst.Y, oAsst.WthContent, oAsst.HgtLine()).fill();
      }

      if (oCkHead)
        // This must be rendered on top of the grey line background:
        oDoc
          .lineWidth(0.5)
          .strokeColor("black")
          .moveTo(oAsst.MargLeft, oAsst.Y)
          .lineTo(oAsst.BoundRight, oAsst.Y)
          .stroke();

      // Variety data
      // ············

      oAsst.Set_NameFont("Helvetica");
      oAsst.Set_SizeFont(oSizeFontVty);
      oAsst.Set_ColorFill("black");
      oAsst.Return();

      const oName = TextIDVty(oVty.IDVty) + "  " + NameVty(oVty);
      oAsst.Write(oName, oOptsNameVty);

      oText = TextCurr(oVty.Price);
      oAsst.Write(oText, oOptsValVty);

      oAsst.Write(oVty.QtyProm, oOptsValVty);

      oAsst.Write(oVty.QtyDeliv, oOptsValVty);

      // The weight or an em-dash:
      oText = oVty.WgtTtl ? TextWgt(oVty.WgtTtl) : "\u2014";
      oAsst.Write(oText, oOptsValVty);

      oText = TextCurr(oVty.SaleNom);
      oAsst.Write(oText, oOptsValVty);

      oText = TextCurr(oVty.FeeCoop);
      oAsst.Write(oText, oOptsValVty);

      oText = TextCurr(oVty.FeeInvt);
      oAsst.Write(oText, oOptsValVty);

      oText = TextCurr(oVty.Subtotal);
      oAsst.Write(oText, oOptsValVty);

      oAsst.Y += oAsst.HgtLine();
    }
  }

  // Totals
  // ······

  const oWthLblTtls = 2.4 * 72;
  const oWthValTtls = 0.8 * 72;
  const oWthColTtls = oWthLblTtls + oWthValTtls;

  const oLeftTtls = oAsst.MargLeft;

  const oOptsValTtl = {
    width: 0.75 * 72,
    align: "right",
  };

  const oHgtTtls = oAsst.HgtLine() * 7.5;
  oAsst.CkAddPage(oHgtTtls);

  oAsst.Set_NameFont("Helvetica-Bold");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  oAsst.Return();
  oAsst.Next();
  oAsst.WriteLine("TOTALS");
  oAsst.Next();

  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  const oTopTtls = oAsst.Y;

  oAsst.Set_ColorFill("#E0E0E0");
  oDoc.rect(oLeftTtls, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
  oAsst.Next();
  oAsst.Next();
  oDoc.rect(oLeftTtls, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
  oAsst.Next();
  oAsst.Next();
  oDoc.rect(oLeftTtls, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
  oAsst.Set_ColorFill("black");

  oAsst.X = oLeftTtls;
  oAsst.Y = oTopTtls;

  oAsst.WriteLine("Sales");
  oAsst.WriteLine("Market fees*");
  oAsst.WriteLine("Managed inventory fees");

  oAsst.Return();
  oAsst.Next();

  oAsst.WriteLine("Invoice total");
  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  oAsst.Y = oTopTtls;
  oAsst.X = oLeftTtls + oWthLblTtls;

  oText = TextCurr(oData.SaleNom);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = "- " + TextCurr(oData.FeeCoop);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = "- " + TextCurr(oData.FeeInvt);
  oAsst.WriteLine(oText, oOptsValTtl);

  oAsst.Next();

  oText = TextCurr(oData.Ttl);
  oAsst.WriteLine(oText, oOptsValTtl);

  // Notes
  // ·····

  const oHgtNotes = oAsst.HgtLine() * 2.0;
  oAsst.CkAddPage(oHgtNotes);

  // Isn't there an easier way to wrap at the margin?:
  const oOptsNote = {
    width: oAsst.WthContent,
  };

  oAsst.Return();
  oAsst.Next();

  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontVty);
  oAsst.Set_ColorFill("black");

  // See 'Rounding currency' in 'README.md' for more on this:
  oText =
    "* Fees in the Totals section are correct. Fees in the Variety table " +
    "are rounded to the nearest cent.";
  oAsst.WriteLine(oText, oOptsNote);

  // Close document
  // --------------

  oDoc.end();

  // Store document
  // --------------

  await Storage.files.upload({
    nameFile: oNameFile,
    passThrough: oPassThrough,
  });

  return oIDInvc;
}

async function wDataInvc(aIDCyc, aIDProducer, aConn) {
  const oData = {
    Products: [],

    SaleNom: 0,
    FeeCoop: 0,
    FeeInvt: 0,
    Ttl: 0,
  };

  // Get items
  // ---------

  // This query aggregates variety weights as WgtTtl, so sale subtotals will be
  // calculated by group weight, not individual weight:
  const oSQL = `SELECT ItDeliv.IDVty,
			SUM(ItDeliv.QtyProm) AS QtyProm, SUM(ItDeliv.QtyDeliv) AS QtyDeliv,
			SUM(ItDeliv.WgtPer) AS WgtTtl,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.CkInvtMgd,
			Vty.PriceNomWeb,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct
		FROM ItDeliv
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		WHERE ItDeliv.IDCyc = :IDCyc
			AND Product.IDProducer = :IDProducer
		GROUP BY ItDeliv.IDVty
		ORDER BY Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDCyc: aIDCyc,
    IDProducer: aIDProducer,
  };
  const [oIts] = await aConn.wExecPrep(oSQL, oParams);

  // Structure by product
  // --------------------
  let oProductLast;
  for (const oIt of oIts) {
    if (!oProductLast || oIt.IDProduct != oProductLast.IDProduct) {
      oProductLast = {
        IDProduct: oIt.IDProduct,
        NameProduct: oIt.NameProduct,
        Vtys: [],
      };
      oData.Products.push(oProductLast);
    }

    oIt.Price = oIt.PriceNomWeb;

    const oFacPrice = oIt.CkPriceVar ? oIt.WgtTtl : oIt.QtyDeliv;
    const oSaleNom = round(oIt.Price * oFacPrice, 2);
    oData.SaleNom += oSaleNom;

    //check if product id is set to exclude producer fee
    const feeCheck = await getProductRow(oIt.IDProduct);
    let oFeeCoop;
    if (!feeCheck[0].CkExcludeProducerFee) {
      oFeeCoop = round(oSaleNom * Site.FracFeeCoopProducer, 2);
    } else {
      oFeeCoop = 0.0;
    }

    oData.FeeCoop += oFeeCoop;

    const oFeeInvt = oIt.CkInvtMgd ? Site.FeeInvtIt * oIt.QtyDeliv : 0;
    oData.FeeInvt += oFeeInvt;

    const oSubtotal = oSaleNom - oFeeCoop - oFeeInvt;
    oData.Ttl += oSubtotal;

    oProductLast.Vtys.push({
      IDVty: oIt.IDVty,
      Kind: oIt.Kind,
      Size: oIt.Size,
      WgtMin: oIt.WgtMin,
      WgtMax: oIt.WgtMax,
      CkPriceVar: oIt.CkPriceVar,
      QtyProm: oIt.QtyProm,
      QtyDeliv: oIt.QtyDeliv,
      WgtTtl: oIt.WgtTtl,
      Price: oIt.Price,
      SaleNom: oSaleNom,
      FeeCoop: oFeeCoop,
      FeeInvt: oFeeInvt,
      Subtotal: oSubtotal,
    });
  }

  return oData;
}

async function wUpsert_Invc(aIDCyc, aIDProducer, aNameFile, aData, aConn) {
  const oSQL = `INSERT INTO InvcProducerWeb (
			IDCyc, IDProducer, NameFileInvc, SaleNom, FeeCoop, FeeInvt, Ttl
		)
		VALUES (
			:IDCyc, :IDProducer, :NameFileInvc, :SaleNom, :FeeCoop, :FeeInvt, :Ttl
		)
		ON DUPLICATE KEY UPDATE
			NameFileInvc = :NameFileInvc, SaleNom = :SaleNom, FeeCoop = :FeeCoop,
			FeeInvt = :FeeInvt, Ttl = :Ttl, WhenUpd = NOW()`;
  const oParams = {
    IDCyc: aIDCyc,
    IDProducer: aIDProducer,
    NameFileInvc: aNameFile,
    SaleNom: aData.SaleNom,
    FeeCoop: aData.FeeCoop,
    FeeInvt: aData.FeeInvt,
    Ttl: aData.Ttl,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  // For some reason, 'affectedRows' is two when the update is triggered.
  // Perhaps the first row is the attempted insert, and the second the actual
  // update. Also, failed inserts increment the IDInvcProducerWeb counter, even
  // though no new record was produced:
  if (oRows.affectedRows < 1)
    throw Error("InvcProducerWeb wUpsert_Invc: Cannot insert or update invoice " + "record");
  return oRows.insertId;
}
