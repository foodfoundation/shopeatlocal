// InvcProducerOnsite.js
// ---------------------
// On-site producer invoice generation

import gAsstPDF from "./AsstPDF.js";
import { Wth, Data } from "./SVGLogoTextGrey.js";
import { wMembFromID } from "./Db.js";
import {
  NameRndAlphaNum,
  TextIDInvcProducerOnsite,
  TextIDCyc,
  TextIDProducer,
  TextWhen,
  TextIDProduct,
  TextIDVty,
  NameVty,
  TextCurr,
  TextWgt,
} from "./Util.js";
import { LenNameFileStoreDoc } from "../Cfg.js";
import { CoopParams } from "./Site.js";
import { Storage } from "./Storage.js";
import { PassThrough } from "stream";

import gPDFKit from "pdfkit";
import gSVGPDFKit from "svg-to-pdfkit";
import _ from "lodash";

/** Creates and stores a producer invoice PDF document
 *  @param {Connection} aConn - Database connection with active transaction
 *  @param {Object} aCyc - Cycle data
 *  @param {Object} aProducer - Producer data
 *  @param {string} aCdCartType - Cart type code
 *  @throws {Error} If PDF generation or storage fails
 *  @note Transaction should be rolled back if an error occurs
 */
export async function wCreate(aConn, aCyc, aProducer, aCdCartType) {
  const oMemb = await wMembFromID(aProducer.IDMemb, aConn);
  const oData = await wDataInvc(aCyc, aProducer, aConn, aCdCartType);

  // This must be done before the file is created, so that the invoice number
  // can be displayed in the invoice:
  const oNameFile = NameRndAlphaNum(LenNameFileStoreDoc) + ".pdf";
  const { CdInvcType: oCdInvcType } = oData;
  const oIDInvc = await wIns_Invc(aCyc, aProducer, oNameFile, oData, aConn);

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

  const oIDTextInvc = TextIDInvcProducerOnsite(oIDInvc);

  // The current page number. PDFKit doesn't seem to publish this, unbelievable
  // as that sounds:
  let oNumPage = 0;

  const oRend_Footer = function () {
    ++oNumPage;

    const oFooterTextLeft = `${oCdInvcType === "Wholesale" ? "Wholesale" : "On-site"} producer invoice ${oIDTextInvc}`;
    const host = new URL(CoopParams.HomeWebsite).host;

    oAsst.Footer(oFooterTextLeft, host, "Page " + oNumPage);
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
  const oTitleText = `${oCdInvcType === "Wholesale" ? "WHOLESALE" : "ON-SITE"} PRODUCER INVOICE`;
  oAsst.WriteLine(oTitleText);

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
    const oOptsPriceVty = {
      width: 0.75 * 72,
      align: "right",
    };
    const oOptsValVty = {
      width: (3.75 / 6) * 72,
      align: "right",
    };

    const oOptsHeadNameVty = {
      width: oOptsNameVty.width,
      lineBreak: true,
      baseline: "top",
    };
    const oOptsHeadPriceVty = {
      ...oOptsPriceVty,
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
        oAsst.Write("\nPrice", oOptsHeadPriceVty);
        oAsst.Write("Qty\nSold", oOptsHeadValVty);
        oAsst.Write("Wgt\nSold", oOptsHeadValVty);
        oAsst.Write("\nSales", oOptsHeadValVty);
        oAsst.Write("Co-op\nfees", oOptsHeadValVty);
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

      if (oVty.PriceNomMax === oVty.PriceNomMin) oText = TextCurr(oVty.PriceNomMin);
      else oText = TextCurr(oVty.PriceNomMin) + "-" + TextCurr(oVty.PriceNomMax);
      oAsst.Write(oText, oOptsPriceVty);

      oAsst.Write(oVty.Qty, oOptsValVty);

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
  oAsst.WriteLine("Co-op fees*");
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
}

async function wDataInvc(aCyc, aProducer, aConn, aCdCartType) {
  const oData = {
    Products: [],

    SaleNom: 0,
    FeeCoop: 0,
    FeeInvt: 0,
    Ttl: 0,
  };

  // Get items
  // ---------
  // In web invoices, only a single price is displayed, because all web shoppers
  // pay the same price for a given variety in a single cycle. There is no way
  // to enforce such a requirement for on-site purchases, so a price range is
  // displayed here. It might be better to include the price in the GROUP BY
  // instead, but I would have to review the rest of the module to be sure that
  // is safe.
  //
  // Fields like SaleNom that are calculated at invoice time for web items are
  // calculated at sale time for on-site items. For this reason, they are
  // already in the table, and need not be calculated here.

  // Other invoices calculate sale totals themselves, on demand. On-site sale
  // prices are determined at the time of each sale, not least because a range
  // of on-site prices may be encountered during the same cycle. Therefore, this
  // invoice aggregates historical data to calculate the sale subtotal. Because
  // on-site sales are priced by individual weight, this invoice prices them
  // that way too:
  const oSQL = `SELECT ItCartOnsite.IDVty,
			SUM(ItCartOnsite.Qty) AS Qty,
			SUM(ItCartOnsite.WgtTtl) AS WgtTtl,
			MIN(ItCartOnsite.PriceNom) AS PriceNomMin,
			MAX(ItCartOnsite.PriceNom) AS PriceNomMax,
			SUM(ItCartOnsite.SaleNom) AS SaleNom,
			SUM(ItCartOnsite.FeeCoopProducer) AS FeeCoop,
			SUM(ItCartOnsite.FeeInvt) AS FeeInvt,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.CkInvtMgd,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct,
			CartOnsite.CdCartType AS CdCartType
		FROM ItCartOnsite
		JOIN CartOnsite USING (IDCartOnsite)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		WHERE (CartOnsite.IDCyc = :IDCyc)
			AND (Product.IDProducer = :IDProducer)
			AND (CartOnsite.CdCartType = :CdCartType)
		GROUP BY ItCartOnsite.IDVty, CartOnsite.CdCartType
		ORDER BY Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDCyc: aCyc.IDCyc,
    IDProducer: aProducer.IDProducer,
    CdCartType: aCdCartType,
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

    oData.SaleNom += oIt.SaleNom;
    oData.FeeCoop += oIt.FeeCoop;
    oData.FeeInvt += oIt.FeeInvt;

    const oSubtotal = oIt.SaleNom - oIt.FeeCoop - oIt.FeeInvt;
    oData.Ttl += oSubtotal;

    oData.CdInvcType = oIt.CdCartType;

    oProductLast.Vtys.push({
      IDVty: oIt.IDVty,
      Kind: oIt.Kind,
      Size: oIt.Size,
      WgtMin: oIt.WgtMin,
      WgtMax: oIt.WgtMax,
      CkPriceVar: oIt.CkPriceVar,
      Qty: oIt.Qty,
      WgtTtl: oIt.WgtTtl,
      PriceNomMin: oIt.PriceNomMin,
      PriceNomMax: oIt.PriceNomMax,
      SaleNom: oIt.SaleNom,
      FeeCoop: oIt.FeeCoop,
      FeeInvt: oIt.FeeInvt,
      Subtotal: oSubtotal,
    });
  }

  return oData;
}

async function wIns_Invc(aCyc, aProducer, aNameFile, aData, aConn) {
  const oSQL = `INSERT INTO InvcProducerOnsite (
			IDCyc, IDProducer, NameFileInvc, SaleNom, FeeCoop, FeeInvt, Ttl, CdInvcType
		)
		VALUES (
			:IDCyc, :IDProducer, :NameFileInvc, :SaleNom, :FeeCoop, :FeeInvt, :Ttl, :CdInvcType
		)`;
  const oParams = {
    IDCyc: aCyc.IDCyc,
    IDProducer: aProducer.IDProducer,
    NameFileInvc: aNameFile,
    SaleNom: aData.SaleNom,
    FeeCoop: aData.FeeCoop,
    FeeInvt: aData.FeeInvt,
    Ttl: aData.Ttl,
    CdInvcType: aData.CdInvcType,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows !== 1)
    throw Error("InvcProducerOnsite wIns_Invc: Cannot insert invoice record");
  return oRows.insertId;
}
