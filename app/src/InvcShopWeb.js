// InvcShopWeb.js
// --------------
// Web shopper invoice generation

import gAsstPDF from "./AsstPDF.js";
import { Wth, Data } from "./SVGLogoTextGrey.js";
import {
  NameRndAlphaNum,
  TextIDInvcShopWeb,
  TextIDCyc,
  TextYesNo,
  TextWhen,
  TextIDMemb,
  TextIDProducer,
  TextIDProduct,
  TextIDVty,
  NameVty,
  TextCurr,
  TextWgt,
  Add_CkExcludeConsumerFee,
  TtlsCart,
} from "./Util.js";
import { Locs, CoopParams } from "./Site.js";
import { LenNameFileStoreDoc } from "../Cfg.js";
import { Storage } from "./Storage.js";
import { PassThrough } from "stream";

import gPDFKit from "pdfkit";
import gSVGPDFKit from "svg-to-pdfkit";
import _ from "lodash";

/** Manages web shopper invoice lifecycle
 *  @param {Connection} aConn - Database connection with active transaction
 *  @param {Object} aCyc - Cycle data
 *  @param {Object} aMemb - Member data
 *  @param {Object} aCart - Cart data
 *  @param {string} aCdStatCart - Cart status code
 *  @returns {Object} Invoice generation data
 *  @throws {Error} If PDF generation or storage fails
 *  @note Transaction rollback required on error to maintain data consistency
 */
export async function wCreate(aConn, aCyc, aMemb, aCart, aCdStatCart) {
  const oCkRegEBT = aMemb.CdRegEBT === "Approv";

  const oLoc = Locs[aCart.CdLoc];
  if (!oLoc) throw Error("InvcShopWeb wCreate: Cannot get location");

  const oData = await wDataInvc(aMemb, aCart, aConn);

  // This must be done before the file is created, so that the invoice number
  // can be displayed in the invoice:
  const oNameFile = NameRndAlphaNum(LenNameFileStoreDoc) + ".pdf";
  oData.IDInvc = await wUpsert_Invc(aCart.IDCart, oNameFile, oData, aConn);

  // Create document
  // ---------------

  const oOptsPage = {
    layout: "landscape",
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

  const oIDTextInvc = TextIDInvcShopWeb(oData.IDInvc);

  // The current page number. PDFKit doesn't seem to publish this, unbelievable
  // as that sounds:
  let oNumPage = 0;

  const oRend_Footer = function () {
    ++oNumPage;

    const host = new URL(CoopParams.HomeWebsite).host;

    oAsst.Footer(`Web shopper invoice ${oIDTextInvc}`, host, "Page " + oNumPage);
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
  oAsst.WriteLine("WEB SHOPPER INVOICE");

  const oX = 10.5 * 72 - Wth;
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

  oSize = oAsst.WriteLine("EBT approved");
  oWthColLbl = Math.max(oWthColLbl, oSize.Wth);

  oSize = oAsst.WriteLine("Pickup location");
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

  oText = TextYesNo(oCkRegEBT);
  oAsst.WriteLine(oText);

  oText = oLoc.NameLoc;
  oAsst.WriteLine(oText);

  const oNow = new Date();
  oText = TextWhen(oNow, "FullMed", "HourMinSec");
  oAsst.WriteLine(oText);

  // Member table
  // ············

  oAsst.Set_NameFont("Helvetica-Bold");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  const oOptsMemb = {
    width: 3.75 * 72,
    height: oSizeFontMain,
    ellipsis: true,
    align: "right",
  };

  oAsst.X = oAsst.BoundRight - oOptsMemb.width;
  oAsst.Y = oTopTbl;

  oText = "Member " + TextIDMemb(aMemb.IDMemb, oOptsMemb);
  oAsst.WriteLine(oText, oOptsMemb);

  oText = aMemb.Name1First + " " + aMemb.Name1Last;
  oAsst.WriteLine(oText, oOptsMemb);

  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  if (aMemb.NameBus) oAsst.WriteLine(aMemb.NameBus, oOptsMemb);

  oAsst.WriteLine(aMemb.Addr1, oOptsMemb);

  if (aMemb.Addr2) oAsst.WriteLine(aMemb.Addr2, oOptsMemb);

  oText = aMemb.City + ", " + aMemb.St + " " + aMemb.Zip;
  oAsst.WriteLine(oText, oOptsMemb);

  oBtmTbl = Math.max(oBtmTbl, oAsst.Y);
  oAsst.Y = oBtmTbl;

  // Producers
  // ·········

  const oHgtHeadVty = oSizeFontHead;

  for (const oProducer of oData.Producers) {
    oAsst.X = oAsst.MargLeft;
    oAsst.Y += oSizeFontMain;

    oAsst.Set_NameFont("Helvetica-Bold");
    oAsst.Set_SizeFont(oSizeFontMain);
    oAsst.Set_ColorFill("black");

    const oHgtHeadProducer = oAsst.HgtLine() * 2 + oHgtHeadVty + oSizeFontVty * 1.5;
    oAsst.CkAddPage(oHgtHeadProducer);

    oText = "PRODUCER " + TextIDProducer(oProducer.IDProducer) + ": " + oProducer.NameBus;
    oAsst.WriteLine(oText);

    // Varieties
    // ·········

    const oOptsNameProductVty = {
      width: 3.0 * 72,
      height: oSizeFontVty,
      ellipsis: true,
    };
    const oOptsValVty = {
      width: (3.25 / 6) * 72,
      align: "right",
    };
    const oOptsSubtotVty = {
      width: 0.75 * 72,
      align: "right",
    };

    const oOptsHeadNameProductVty = {
      width: oOptsNameProductVty.width,
      lineBreak: true,
      baseline: "top",
    };
    const oOptsHeadValVty = {
      ...oOptsValVty,
      lineBreak: true,
      baseline: "top",
    };
    const oOptsHeadSubtotVty = {
      ...oOptsSubtotVty,
      lineBreak: true,
      baseline: "top",
    };

    // Variety records
    // ···············

    oAsst.Set_SizeFont(oSizeFontVty);
    oAsst.ScaleLine = 1.4;

    for (let oIdxVty = 0; oIdxVty < oProducer.Vtys.length; ++oIdxVty) {
      const oVty = oProducer.Vtys[oIdxVty];

      // Variety heading
      // ···············

      const oCkHead = !oIdxVty || oAsst.CkAddPage(oAsst.HgtLine());
      if (oCkHead) {
        oAsst.Set_NameFont("Helvetica-Bold");
        oAsst.Set_SizeFont(oSizeFontVty);
        oAsst.Set_ColorFill("black");
        oAsst.Return();

        oAsst.Write("\nProduct", oOptsHeadNameProductVty);
        oAsst.Write("\nVariety", oOptsHeadNameProductVty);
        oAsst.Write("\nPrice", oOptsHeadValVty);
        oAsst.Write("Qty\nOrder", oOptsHeadValVty);
        oAsst.Write("Qty\nOOS", oOptsHeadValVty);
        oAsst.Write("Qty\nReject", oOptsHeadValVty);
        oAsst.Write("Qty\nSold", oOptsHeadValVty);
        oAsst.Write("Wgt\nSold", oOptsHeadValVty);
        oAsst.Write("\nSubtot", oOptsHeadSubtotVty);

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

      oAsst.Return();

      oAsst.Set_NameFont("Helvetica");
      oAsst.Set_SizeFont(oSizeFontVty);
      oAsst.Set_ColorFill("black");

      const oMarkNote = oVty.NoteShop ? "*" : "";
      oText = oMarkNote + TextIDProduct(oVty.IDProduct) + "  " + oVty.NameProduct;
      oAsst.Write(oText, oOptsNameProductVty);

      oText = TextIDVty(oVty.IDVty) + "  " + NameVty(oVty);
      oAsst.Write(oText, oOptsNameProductVty);

      oText = TextCurr(oVty.PriceNomWeb);
      oAsst.Write(oText, oOptsValVty);

      oAsst.Write(oVty.QtyOrd, oOptsValVty);

      const oQtyOOS = oVty.QtyOrd - oVty.QtyReject - oVty.QtySold;
      oAsst.Write(oQtyOOS, oOptsValVty);

      oAsst.Write(oVty.QtyReject, oOptsValVty);

      oAsst.Write(oVty.QtySold, oOptsValVty);

      // The weight or an em-dash:
      oText = oVty.WgtTtl ? TextWgt(oVty.WgtTtl) : "\u2014";
      oAsst.Write(oText, oOptsValVty);

      oText = TextCurr(oVty.SaleNom);
      // CkTaxSaleEff was added by TtlsCart. It accounts for the fact that EBT
      // users are not assessed sales tax for EBT-eligible items:
      if (oVty.CkTaxSaleEff) oText += "\u2020";
      if (oCkRegEBT && oVty.CkEBT) oText += "\u2021";
      oAsst.Write(oText, oOptsSubtotVty);

      oAsst.Next();
    }
  }

  // Notes
  // ·····

  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  oAsst.Return();
  oAsst.Next();

  const oHgtNotes = oAsst.HgtLine() * 2.0;
  oAsst.CkAddPage(oHgtNotes);

  oAsst.WriteLine("* Items with shopper notes");
  if (oCkRegEBT) oAsst.WriteLine("\u2021 EBT-eligible items");

  // Totals
  // ······

  const oWthLblTtls = 2.4 * 72;
  const oWthValTtls = 0.8 * 72;
  const oWthColTtls = oWthLblTtls + oWthValTtls;
  const oWthGutTtls = 0.2 * 72;

  const oLeftTtls0 = oAsst.MargLeft;
  const oLeftTtls1 = oAsst.MargLeft + oWthColTtls + oWthGutTtls;
  const oLeftTtls2 = oAsst.MargLeft + (oWthColTtls + oWthGutTtls) * 2;

  const oOptsValTtl = {
    width: 0.75 * 72,
    align: "right",
  };

  oAsst.Return();
  oAsst.Next();

  const oHgtTtls = oAsst.HgtLine() * 5.5;
  oAsst.CkAddPage(oHgtTtls);

  oAsst.Set_NameFont("Helvetica-Bold");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  oAsst.WriteLine("TOTALS");
  oAsst.Next();

  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  const oTopTtls = oAsst.Y;

  // Background

  oAsst.Y = oTopTtls;

  oAsst.Set_ColorFill("#E0E0E0");

  oDoc.rect(oLeftTtls0, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
  oDoc.rect(oLeftTtls1, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
  oDoc.rect(oLeftTtls2, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
  oAsst.Next();
  oAsst.Next();
  oDoc.rect(oLeftTtls0, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
  oDoc.rect(oLeftTtls1, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
  oDoc.rect(oLeftTtls2, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();

  oAsst.Set_ColorFill("black");

  // Left column

  oAsst.X = oLeftTtls0;
  oAsst.Y = oTopTtls;

  oAsst.WriteLine("Non-taxable sales");
  oAsst.WriteLine("Market fee on non-taxable sales");
  oAsst.WriteLine("Non-taxable subtotal");

  oAsst.X += oWthLblTtls;
  oAsst.Y = oTopTtls;

  oText = TextCurr(oData.SaleNomNontaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(oData.FeeCoopShopNontaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(oData.SubNontaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  // Middle column

  oAsst.X = oLeftTtls1;
  oAsst.Y = oTopTtls;
  oAsst.WriteLine("\u2020Taxable sales");
  oAsst.WriteLine("Market fee on taxable sales");
  oAsst.WriteLine("Taxable subtotal");

  oAsst.X += oWthLblTtls;
  oAsst.Y = oTopTtls;

  oText = TextCurr(oData.SaleNomTaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(oData.FeeCoopShopTaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(oData.SubTaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  // Right column

  oAsst.X = oLeftTtls2;
  oAsst.Y = oTopTtls;
  oAsst.WriteLine("Sales tax");
  oAsst.WriteLine("Transfer/delivery fee");
  oAsst.WriteLine("Invoice total");

  oAsst.X += oWthLblTtls;
  oAsst.Y = oTopTtls;

  oText = TextCurr(oData.TaxSale);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(oData.FeeDelivTransfer);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(oData.Ttl);
  oAsst.WriteLine(oText, oOptsValTtl);

  // EBT detail
  // ··········

  if (oCkRegEBT) {
    oAsst.Set_NameFont("Helvetica");
    oAsst.Set_SizeFont(oSizeFontMain);
    oAsst.Set_ColorFill("black");

    oAsst.Next();

    const oHgtDtlEBT = oAsst.HgtLine() * 3.5;
    oAsst.CkAddPage(oHgtDtlEBT);

    oAsst.Set_NameFont("Helvetica-Bold");
    oAsst.Set_SizeFont(oSizeFontMain);
    oAsst.Set_ColorFill("black");

    oAsst.Return();
    oAsst.WriteLine("EBT DETAIL");
    oAsst.Next();

    oAsst.Set_NameFont("Helvetica");
    oAsst.Set_SizeFont(oSizeFontMain);
    oAsst.Set_ColorFill("black");

    const oTopDtlEBT = oAsst.Y;

    // Background

    oAsst.Y = oTopDtlEBT;

    oAsst.Set_ColorFill("#E0E0E0");

    oDoc.rect(oLeftTtls0, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();
    oDoc.rect(oLeftTtls1, oAsst.Y, oWthColTtls, oAsst.HgtLine()).fill();

    oAsst.Set_ColorFill("black");

    // Left column

    oAsst.X = oLeftTtls0;
    oAsst.Y = oTopDtlEBT;

    oAsst.WriteLine("Money total");

    oAsst.X += oWthLblTtls;
    oAsst.Y = oTopDtlEBT;

    oText = TextCurr(oData.TtlMoney);
    oAsst.WriteLine(oText, oOptsValTtl);

    // Middle column

    oAsst.X = oLeftTtls1;
    oAsst.Y = oTopDtlEBT;
    oAsst.WriteLine("EBT total");

    oAsst.X += oWthLblTtls;
    oAsst.Y = oTopDtlEBT;

    oText = TextCurr(oData.TtlEBT);
    oAsst.WriteLine(oText, oOptsValTtl);
  }

  // No-show text
  // ············

  if (aCdStatCart === "NoShow" || aCdStatCart === "Miss") {
    oAsst.Set_NameFont("Helvetica-Bold");
    oAsst.Set_SizeFont(oSizeFontMain);
    oAsst.Set_ColorFill("black");

    const oHgtTtls = oAsst.HgtLine() * 2.5;
    oAsst.CkAddPage(oHgtTtls);

    oAsst.Return();
    oAsst.Next();
    oAsst.WriteLine("THE SHOPPER DID NOT PICK UP THIS ORDER");
  }

  // Close document
  // --------------

  oDoc.end();

  // Store document
  // --------------

  await Storage.files.upload({
    nameFile: oNameFile,
    passThrough: oPassThrough,
  });

  return oData;
}

async function wDataInvc(aMemb, aCart, aConn) {
  // Get items
  // ---------

  // This query aggregates variety weights as WgtTtl, so 'Util TtlsCart' will
  // calculate the sale subtotal by group weight, not by individual weight:
  const oSQL = `SELECT ItCart.QtyOrd, ItCart.QtyReject, ItCart.QtySold, ItCart.NoteShop,
			zItsPickup.WgtTtl,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.PriceNomWeb, Vty.CdVtyType,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct,
			Producer.IDProducer, Producer.NameBus,
			Subcat.CkTaxSale, Subcat.CkEBT,
			IFNULL(FeeCoopVty.FracFeeCoopWholesaleMemb, (SELECT FracFeeCoopWholesaleMemb FROM Site)) AS FracFeeCoopWholesaleMemb
		FROM ItCart
		LEFT JOIN (
			SELECT IDItCart, SUM(WgtPer) AS WgtTtl
			FROM ItPickup
			GROUP BY IDItCart
		) AS zItsPickup ON (zItsPickup.IDItCart = ItCart.IDItCart)
		JOIN Cart Using (IDCart)
		JOIN StApp Using (IDCyc)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		JOIN Subcat USING (IDSubcat)
		LEFT JOIN FeeCoopVty USING (IDVty)
		WHERE Cart.IDCyc = :IDCyc
			AND Cart.IDMemb = :IDMemb
		ORDER BY Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDCyc: aCart.IDCyc,
    IDMemb: aMemb.IDMemb,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  const oRowsExtended = await Add_CkExcludeConsumerFee(oRows);

  // Calculate invoice totals
  // ------------------------

  const oCkRegEBT = aMemb.CdRegEBT === "Approv";
  const oCkRegWholesale = aMemb.CdRegWholesale === "Approv";
  const oData = TtlsCart(
    oRowsExtended,
    "QtySold",
    "PriceNomWeb",
    oCkRegEBT,
    aCart.CdLoc,
    aMemb.DistDeliv,
    oCkRegWholesale,
    aMemb.TagIDs,
  );

  // Structure items by producer
  // ---------------------------

  oData.Producers = [];

  let oProducerLast;
  for (const oIt of oData.Its) {
    if (!oProducerLast || oIt.IDProducer != oProducerLast.IDProducer) {
      oProducerLast = {
        IDProducer: oIt.IDProducer,
        NameBus: oIt.NameBus,
        Vtys: [],
      };
      oData.Producers.push(oProducerLast);
    }

    oProducerLast.Vtys.push({
      IDProduct: oIt.IDProduct,
      NameProduct: oIt.NameProduct,
      IDProducer: oIt.IDProducer,
      NameBus: oIt.NameBus,
      IDVty: oIt.IDVty,
      Kind: oIt.Kind,
      Size: oIt.Size,
      WgtMin: oIt.WgtMin,
      WgtMax: oIt.WgtMax,
      CkPriceVar: oIt.CkPriceVar,
      CkTaxSale: oIt.CkTaxSale,
      CkEBT: oIt.CkEBT,
      NoteShop: oIt.NoteShop,
      QtyOrd: oIt.QtyOrd,
      QtyReject: oIt.QtyReject,
      QtySold: oIt.QtySold,
      WgtTtl: oIt.WgtTtl,
      PriceNomWeb: oIt.PriceNomWeb,

      // These fields are added by TtlsCart:
      SaleNom: oIt.SaleNom,
      CkTaxSaleEff: oIt.CkTaxSaleEff,
    });
  }

  return oData;
}

async function wUpsert_Invc(aIDCart, aNameFile, aData, aConn) {
  // Why is this an upsert, rather than an ordinary insert? Because of the
  // unique IDCart key, an insert would prevent an unwanted second checkout:
  // [TO DO]
  const oSQL = `INSERT INTO InvcShopWeb (
			IDCart, NameFileInvc, SaleNomNontaxab, FeeCoopShopNontaxab,
			SaleNomTaxab, FeeCoopShopTaxab, TaxSale, FeeCoopShopForgiv,
			FeeDelivTransfer, TtlMoney, TtlEBT, Ttl
		)
		VALUES (
			:IDCart, :NameFileInvc, :SaleNomNontaxab, :FeeCoopShopNontaxab,
			:SaleNomTaxab, :FeeCoopShopTaxab, :TaxSale, :FeeCoopShopForgiv,
			:FeeDelivTransfer, :TtlMoney, :TtlEBT, :Ttl
		)
		ON DUPLICATE KEY UPDATE
			NameFileInvc = :NameFileInvc, SaleNomNontaxab = :SaleNomNontaxab,
			FeeCoopShopNontaxab = :FeeCoopShopNontaxab,
			SaleNomTaxab = :SaleNomTaxab, FeeCoopShopTaxab = :FeeCoopShopTaxab,
			TaxSale = :TaxSale, FeeCoopShopForgiv = :FeeCoopShopForgiv,
			FeeDelivTransfer = :FeeDelivTransfer,
			TtlMoney = :TtlMoney, TtlEBT = :TtlEBT, Ttl = :Ttl,
			WhenUpd = NOW()`;
  const oParams = {
    IDCart: aIDCart,
    NameFileInvc: aNameFile,
    SaleNomNontaxab: aData.SaleNomNontaxab,
    FeeCoopShopNontaxab: aData.FeeCoopShopNontaxab,
    SaleNomTaxab: aData.SaleNomTaxab,
    FeeCoopShopTaxab: aData.FeeCoopShopTaxab,
    TaxSale: aData.TaxSale,
    FeeCoopShopForgiv: aData.FeeCoopShopForgiv,
    FeeDelivTransfer: aData.FeeDelivTransfer,
    TtlMoney: aData.TtlMoney,
    TtlEBT: aData.TtlEBT,
    Ttl: aData.Ttl,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  // For some reason, 'affectedRows' is two when the update is triggered.
  // Perhaps the first row is the attempted insert, and the second the actual
  // update. Also, failed inserts increment the IDInvcShopWeb counter, even
  // though no new record was produced:
  if (oRows.affectedRows < 1)
    throw Error("InvcShopWeb wUpsert_Invc: Cannot insert or update invoice record");
  return oRows.insertId;
}
