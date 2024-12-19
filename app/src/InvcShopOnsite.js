// InvcShopOnsite.js
// -----------------
// On-site shopper invoice generation

import gAsstPDF from "./AsstPDF.js";
import { Wth, Data } from "./SVGLogoTextGrey.js";
import {
  NameRndAlphaNum,
  TextIDInvcShopOnsite,
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
} from "./Util.js";
import { LenNameFileStoreDoc } from "../Cfg.js";
import { Storage } from "./Storage.js";
import { CoopParams } from "./Site.js";
import { PassThrough } from "stream";

import gPDFKit from "pdfkit";
import gSVGPDFKit from "svg-to-pdfkit";

/** Generates and stores onsite shopper invoice
 *  @param {Connection} aConn - Database connection with active transaction
 *  @param {number} aIDCart - Cart identifier
 *  @param {Object} aCyc - Cycle data
 *  @param {Object} aMembShop - Shopper member data
 *  @param {boolean} aCkEligEBT - EBT eligibility flag
 *  @param {Array} aProducers - List of producers
 *  @param {Object} aTtls - Transaction totals
 *  @param {string} aCdCartType - Cart type code
 *  @returns {number} New invoice ID
 *  @throws {Error} If PDF generation or storage fails
 *  @note Transaction rollback required on error to maintain data consistency
 */
export async function wCreate(
  aConn,
  aIDCart,
  aCyc,
  aMembShop,
  aCkEligEBT,
  aProducers,
  aTtls,
  aCdCartType,
) {
  const oIsWholesaleInvoice = aCdCartType === "Wholesale";

  // This must be done before the file is created, so that the invoice number
  // can be displayed in the invoice:
  const oNameFile = NameRndAlphaNum(LenNameFileStoreDoc) + ".pdf";
  // When web invoices are generated, upserts are performed, allowing invoices
  // to be replaced by repeating the check-in or checkout. It is not possible to
  // repeat an on-site checkout, however, because the pending cart is emptied,
  // and there is no way to select a previous cart. Nor would this be
  // desireable, since the transaction is created immediately on on-site
  // checkout:
  const oIDInvc = await wIns_Invc(aConn, aIDCart, oNameFile, aTtls, aCdCartType);

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

  const oIDTextInvc = TextIDInvcShopOnsite(oIDInvc);

  // The current page number. PDFKit doesn't seem to publish this, unbelievable
  // as that sounds:
  let oNumPage = 0;

  const oRend_Footer = function () {
    ++oNumPage;

    const oFooterTextLeft = `${aCdCartType === "Wholesale" ? "Wholesale" : "On-site"} shopper invoice ${oIDTextInvc}`;
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
  const oTitleText = `${aCdCartType === "Wholesale" ? "WHOLESALE" : "ON-SITE"} SHOPPER INVOICE`;
  oAsst.WriteLine(oTitleText);

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

  oText = TextYesNo(aCkEligEBT);
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

  if (aMembShop) {
    oText = "Member " + TextIDMemb(aMembShop.IDMemb, oOptsMemb);
    oAsst.WriteLine(oText, oOptsMemb);

    oText = aMembShop.Name1First + " " + aMembShop.Name1Last;
    oAsst.WriteLine(oText, oOptsMemb);

    oAsst.Set_NameFont("Helvetica");
    oAsst.Set_SizeFont(oSizeFontMain);
    oAsst.Set_ColorFill("black");

    if (aMembShop.NameBus) oAsst.WriteLine(aMembShop.NameBus, oOptsMemb);

    oAsst.WriteLine(aMembShop.Addr1, oOptsMemb);

    if (aMembShop.Addr2) oAsst.WriteLine(aMembShop.Addr2, oOptsMemb);

    oText = aMembShop.City + ", " + aMembShop.St + " " + aMembShop.Zip;
    oAsst.WriteLine(oText, oOptsMemb);

    oBtmTbl = Math.max(oBtmTbl, oAsst.Y);
  } else oAsst.WriteLine("Non-member purchase", oOptsMemb);

  oAsst.Y = oBtmTbl;

  // Producers
  // ·········

  const oHgtHeadVty = oSizeFontHead;

  for (const oProducer of aProducers) {
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
      width: 3.5 * 72,
      height: oSizeFontVty,
      ellipsis: true,
    };

    const oOptsSizeVtyWholesale = {
      width: 1.75 * 72,
      height: oSizeFontVty,
      ellipsis: true,
    };

    const oOptsValVty = {
      width: oIsWholesaleInvoice ? 0.66 * 72 : (2.25 / 3) * 72,
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

    const oOptsHeadSizeVtyWholesale = {
      width: oOptsSizeVtyWholesale.width,
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
        oAsst.Write(
          "\nVariety",
          oIsWholesaleInvoice ? oOptsHeadSizeVtyWholesale : oOptsHeadNameProductVty,
        );
        oAsst.Write("\nPrice", oOptsHeadValVty);
        oAsst.Write("Qty\nSold", oOptsHeadValVty);
        oAsst.Write("Wgt\nSold", oOptsHeadValVty);
        if (oIsWholesaleInvoice) {
          oAsst.Write("Nom\nPrice", oOptsHeadValVty);
          oAsst.Write("Sales\nTax", oOptsHeadValVty);
          oAsst.Write("Coop\nFee", oOptsHeadValVty);
        }
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

      oAsst.Set_NameFont("Helvetica");
      oAsst.Set_SizeFont(oSizeFontVty);
      oAsst.Set_ColorFill("black");
      oAsst.Return();

      oText = TextIDProduct(oVty.IDProduct) + "  " + oVty.NameProduct;
      oAsst.Write(oText, oOptsNameProductVty);

      oText = TextIDVty(oVty.IDVty) + "  " + NameVty(oVty);
      oAsst.Write(oText, oIsWholesaleInvoice ? oOptsSizeVtyWholesale : oOptsNameProductVty);

      oText = TextCurr(oVty.PriceNomOnsite);
      oAsst.Write(oText, oOptsValVty);

      oAsst.Write(oVty.Qty, oOptsValVty);

      // The weight or an em-dash:
      oText = oVty.WgtTtl ? TextWgt(oVty.WgtTtl) : "\u2014";
      oAsst.Write(oText, oOptsValVty);

      if (oIsWholesaleInvoice) {
        oText = TextCurr(oVty.SaleNom);
        oAsst.Write(oText, oOptsValVty);

        oText = TextCurr(oVty.TaxSale);
        oAsst.Write(oText, oOptsValVty);

        oText = TextCurr(oVty.FeeCoopShop);
        oAsst.Write(oText, oOptsValVty);

        oText = TextCurr(oVty.Sub);
        if (oVty.CkTaxSaleEff) oText += "\u2020";
        oAsst.Write(oText, oOptsSubtotVty);
      } else {
        oText = TextCurr(oVty.SaleNom);
        // A dagger for taxable items:
        if (oVty.CkTaxSaleEff) oText += "\u2020";
        // A double dagger for EBT items:
        if (aCkEligEBT && oVty.CkEBT) oText += "\u2021";
        oAsst.Write(oText, oOptsSubtotVty);
      }

      oAsst.Next();
    }
  }

  // Notes
  // ·····

  oAsst.Set_NameFont("Helvetica");
  oAsst.Set_SizeFont(oSizeFontMain);
  oAsst.Set_ColorFill("black");

  oAsst.Return();

  if (aCkEligEBT) {
    oAsst.Next();

    const oHgtNotes = oAsst.HgtLine();
    oAsst.CkAddPage(oHgtNotes);

    oAsst.WriteLine("\u2021 EBT-eligible items");
  }

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

  const oHgtTtls = oAsst.HgtLine() * 5.5;
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

  // Background

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
  oAsst.WriteLine("Co-op fee on non-taxable sales");
  oAsst.WriteLine("Non-taxable subtotal");

  oAsst.X += oWthLblTtls;
  oAsst.Y = oTopTtls;

  oText = TextCurr(aTtls.SaleNomNontaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(aTtls.FeeCoopShopNontaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(aTtls.SubNontaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  // Middle column

  oAsst.X = oLeftTtls1;
  oAsst.Y = oTopTtls;
  oAsst.WriteLine("\u2020Taxable sales");
  oAsst.WriteLine("Co-op fee on taxable sales");
  oAsst.WriteLine("Taxable subtotal");

  oAsst.X += oWthLblTtls;
  oAsst.Y = oTopTtls;

  oText = TextCurr(aTtls.SaleNomTaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(aTtls.FeeCoopShopTaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  oText = TextCurr(aTtls.SubTaxab);
  oAsst.WriteLine(oText, oOptsValTtl);

  // Right column

  oAsst.X = oLeftTtls2;
  oAsst.Y = oTopTtls;
  oAsst.WriteLine("Sales tax");
  oAsst.Next();
  oAsst.WriteLine("Invoice total");

  oAsst.X += oWthLblTtls;
  oAsst.Y = oTopTtls;

  oText = TextCurr(aTtls.TaxSale);
  oAsst.WriteLine(oText, oOptsValTtl);

  oAsst.Next();

  oText = TextCurr(aTtls.Ttl);
  oAsst.WriteLine(oText, oOptsValTtl);

  // EBT detail
  // ··········

  if (aCkEligEBT) {
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

    oText = TextCurr(aTtls.TtlMoney);
    oAsst.WriteLine(oText, oOptsValTtl);

    // Middle column

    oAsst.X = oLeftTtls1;
    oAsst.Y = oTopDtlEBT;
    oAsst.WriteLine("EBT total");

    oAsst.X += oWthLblTtls;
    oAsst.Y = oTopDtlEBT;

    oText = TextCurr(aTtls.TtlEBT);
    oAsst.WriteLine(oText, oOptsValTtl);
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

  return oIDInvc;
}

async function wIns_Invc(aConn, aIDCart, aNameFile, aTtls, aCdInvcType) {
  const oSQL = `INSERT INTO InvcShopOnsite (
			IDCartOnsite, NameFileInvc, SaleNomNontaxab, FeeCoopShopNontaxab,
			SaleNomTaxab, FeeCoopShopTaxab, TaxSale, FeeCoopShopForgiv,
			TtlMoney, TtlEBT, Ttl, CdInvcType
		)
		VALUES (
			:IDCartOnsite, :NameFileInvc, :SaleNomNontaxab, :FeeCoopShopNontaxab,
			:SaleNomTaxab, :FeeCoopShopTaxab, :TaxSale, :FeeCoopShopForgiv,
			:TtlMoney, :TtlEBT, :Ttl, :CdInvcType
		)`;
  const oParams = {
    IDCartOnsite: aIDCart,
    NameFileInvc: aNameFile,
    SaleNomNontaxab: aTtls.SaleNomNontaxab,
    FeeCoopShopNontaxab: aTtls.FeeCoopShopNontaxab,
    SaleNomTaxab: aTtls.SaleNomTaxab,
    FeeCoopShopTaxab: aTtls.FeeCoopShopTaxab,
    TaxSale: aTtls.TaxSale,
    FeeCoopShopForgiv: aTtls.FeeCoopShopForgiv,
    TtlMoney: aTtls.TtlMoney,
    TtlEBT: aTtls.TtlEBT,
    Ttl: aTtls.Ttl,
    CdInvcType: aCdInvcType,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows < 1) throw Error("InvcShopOnsite wIns_Invc: Cannot insert invoice record");
  return oRows.insertId;
}
