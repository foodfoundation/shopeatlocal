// Lbl.js
// ------
// Label generation utilities

import { DataIt } from "./Barcode.js";
import { TextIDMemb, TextIDProducer, TextIDProduct, TextIDVty, NameVty, TextWgt } from "./Util.js";
import gPDFKit from "pdfkit";
import { create } from "qrcode";
import { access, constants, writeFile, appendFile } from "fs";

/** Label metrics configuration for Avery 5262 format
 *  @constant {Object} Metrics
 *  @property {Object} Avery5262 - Avery 5262 label specifications
 *  @property {number} Avery5262.MargTop - Top margin (7/8", 63pt)
 *  @property {number} Avery5262.MargLeft - Left margin (11/64", 12.375pt)
 *  @property {number} Avery5262.WthLbl - Label width (4", 288pt)
 *  @property {number} Avery5262.HgtLbl - Label height (1 1/3" + 0.5pt, 96.5pt)
 *  @property {number} Avery5262.WthGutter - Gutter width (3/16", 13.5pt)
 *  @property {number} Avery5262.CtPerPage - Labels per page (14)
 */
export const Metrics = {
  /** Avery 5262 labels. */
  Avery5262: {
    // 7/8":
    MargTop: 63,
    // 11/64":
    MargLeft: 12.375,
    // 4":
    WthLbl: 288,
    // 1 1/3" + 0.5pt:
    HgtLbl: 96.5,
    // 3/16":
    WthGutter: 13.5,
    CtPerPage: 14,
  },
};
/** The default label metrics. */
Metrics.Def = Metrics.Avery5262;
Object.freeze(Metrics);

/** Generates PDF item labels and streams to client
 *  @param {Response} aResp - HTTP response object
 *  @param {Array} aIts - Array of items to label
 *  @param {boolean} [moreLbls=false] - Additional labels flag
 *  @throws {Error} If variable-price item lacks weight
 *  @note Generates one label per array element
 */
export async function wSend_LblsIt(aResp, aIts, moreLbls = false) {
  const oMetrics = Metrics.Def;

  function _logError(message) {
    const errorFilePath = "errors.txt";

    // Checking to see if error file exist: errorFilePath
    access(errorFilePath, constants.F_OK, err => {
      if (err) {
        // File does not exist, create it
        writeFile(errorFilePath, "", _err => {});
      }

      // Writing error to errors file: errorFilePath
      appendFile(errorFilePath, `${message}`, err => {
        if (err) {
          console.error(err);
        }
      });
    });
  }

  let columnCount = 2;
  if (moreLbls === true) {
    //.5":
    oMetrics.MargTop = 36;
    // 3/16":
    oMetrics.MargLeft = 13.5;
    // 2-5/8":
    oMetrics.WthLbl = 189;
    // 1" + 1.0:
    oMetrics.HgtLbl = 73;
    // 1/8":
    oMetrics.WthGutter = 9;
    oMetrics.CtPerPage = 30;
    columnCount = 3;
  } else {
    // 7/8":
    (oMetrics.MargTop = 63),
      // 11/64":
      (oMetrics.MargLeft = 12.375),
      // 4":
      (oMetrics.WthLbl = 288),
      // 1 1/3" + 0.5pt:
      (oMetrics.HgtLbl = 96.5),
      // 3/16":
      (oMetrics.WthGutter = 13.5),
      (oMetrics.CtPerPage = 14);
  }

  let oOptsPage = {
    // Are these used?: [TO DO]
    margins: {
      // 13/16":
      top: 58.5,
      // 11/64":
      left: 12.375,
    },
    autoFirstPage: false,
  };
  if (moreLbls === true) {
    //oOptsPage.layout = 'landscape';
  }
  const oDoc = new gPDFKit(oOptsPage);

  oDoc.pipe(aResp);

  for (let oIdxIt = 0; oIdxIt < aIts.length; ++oIdxIt) {
    const oIt = aIts[oIdxIt];

    // --------
    // Add page
    // --------

    if (!(oIdxIt % oMetrics.CtPerPage)) {
      if (oIdxIt) oDoc.stroke();
      oDoc.addPage();
    }

    // ------------------
    // Calculate position
    // ------------------

    const oIdxPg = Math.trunc(oIdxIt / oMetrics.CtPerPage);
    const oIdxLblPg = oIdxIt - oIdxPg * oMetrics.CtPerPage;

    let oIdxCol = oIdxLblPg % columnCount;
    let oIdxRow = Math.trunc(oIdxLblPg / columnCount);

    const oLeftLbl = oMetrics.MargLeft + oIdxCol * (oMetrics.WthLbl + oMetrics.WthGutter);
    const oTopLbl = oMetrics.MargTop + oIdxRow * oMetrics.HgtLbl;
    // Actually just past the right edge:
    let oRightLbl = oLeftLbl + oMetrics.WthLbl;
    if (moreLbls === true) {
      //oRightLbl = oRightLbl - 130;
    }
    // Actually just past the bottom edge:
    const _oBtmLbl = oTopLbl + oMetrics.HgtLbl;

    const oPadX = 8;
    const oPadY = 8;

    let oLeftContent = oLeftLbl + oPadX;
    if (moreLbls === true) {
      //oLeftContent = oLeftContent / 1.1;
    }
    const oTopContent = oTopLbl + oPadY;

    let oSizeBarcode = 72;
    if (moreLbls === true) {
      oSizeBarcode = 60;
    }
    const oSpaceBarcode = oMetrics.HgtLbl;
    const oMargBarcode = (oSpaceBarcode - oSizeBarcode) / 2;
    const oLeftBarcode = oRightLbl - oSpaceBarcode + oMargBarcode;
    const oTopBarcode = oTopLbl + oMargBarcode;

    let oWthText = oLeftBarcode - oPadX - oLeftContent;
    if (moreLbls === true) {
      //oWthText = oWthText - 10;
    }

    let oSizeFontMain = 10;
    let oSizeFontNote = 8;

    // Label outlines, for testing:
    //
    // oDoc
    // 	.lineWidth(0.1)
    // 	.undash()
    // 	.rect(oLeftLbl, oTopLbl, aMetrics.WthLbl, aMetrics.HgtLbl)
    // 	.stroke();

    // ------------------
    // Draw label content
    // ------------------
    // We could print the time or other metadata outside the label area. Doesn't
    // seem necessary right now.
    //
    // The 'moveDown' method does not work as expected when certain 'text'
    // options are set, so it is better to advance the coordinates manually.

    let oText;
    let oOpts;

    let oX = oLeftContent;
    let oY = oTopContent;

    // Storage code and shopper
    // ------------------------

    oDoc.font("Helvetica");
    oDoc.fontSize(oSizeFontMain);

    oText = oIt.CdStor;
    if (oIt.NoteShop)
      oText += ` / ${oIt.CdLoc} ${TextIDMemb(oIt.IDMemb)}` + ` ${oIt.Name1First} ${oIt.Name1Last}`;

    oOpts = { width: oWthText, height: oSizeFontMain, ellipsis: true };

    oDoc.text(oText, oX, oY, oOpts);

    // Producer
    // --------

    oX = oLeftContent;
    oY += 12;

    oDoc.font("Helvetica-Bold");
    oDoc.fontSize(oSizeFontMain);

    oText = TextIDProducer(oIt.IDProducer) + " " + oIt.NameBus;
    oDoc.text(oText, oX, oY, oOpts);

    // Product
    // -------

    oX = oLeftContent;
    oY += 12;

    oText = TextIDProduct(oIt.IDProduct) + " " + oIt.NameProduct;
    oDoc.text(oText, oX, oY, oOpts);

    // Variety
    // -------

    oX = oLeftContent;
    oY += 12;

    oText = TextIDVty(oIt.IDVty) + " " + NameVty(oIt, oIt);
    oDoc.text(oText, oX, oY, oOpts);

    // Weight and shopper note
    // -----------------------

    oX = oLeftContent;
    oY += 12;

    if (oIt.CkPriceVar && !oIt.WgtPer)
      throw Error("wSend_LblsIt: Variable-price item lacks weight");

    if (oIt.WgtPer || oIt.NoteShop) {
      // Horizontal rule:

      const oWthLine = oWthText - oPadX * 2;
      oDoc
        .moveTo(oX, oY)
        .lineWidth(0.5)
        .dash(1)
        .lineTo(oX + oWthLine, oY)
        .stroke();

      oX = oLeftContent;
      oY += 5;

      // Weight:

      oDoc.font("Helvetica");
      oDoc.fontSize(oSizeFontNote);

      if (oIt.WgtPer) {
        oText = TextWgt(oIt.WgtPer) + " lb actual";
        if (oIt.NoteShop) oText += " + ";
      }
      // When using this insane 'continued' mode, it seems easier to print blank
      // lines (and thereby follow the same options and rendering path each
      // time) than it is to skip 'text' calls we do not need:
      else oText = "";

      const oOptsWgtPer = {
        width: oWthText,
        height: 3 * oSizeFontNote + 4,
        ellipsis: true,
        continued: true,
      };
      oDoc.text(oText, oX, oY, oOptsWgtPer);

      // Shopper note
      // ------------

      oDoc.font("Helvetica-Oblique");
      oDoc.fontSize(oSizeFontNote);

      if (oIt.NoteShop) oText = oIt.NoteShop;
      else oText = "";

      oDoc.text(oText);
    }

    // Barcode
    // -------

    const oDataBarcode = DataIt(oIt.IDVty, oIt.WgtPer, oIt.IDItCart);
    await wDraw_Barcode(oDoc, oLeftBarcode, oTopBarcode, oSizeBarcode, oDataBarcode);
  }
  oDoc.end();
}

async function wDraw_Barcode(aDoc, aLeft, aTop, aSize, aText) {
  // It is also possible to extract an SVG path from the 'd' attribute in the
  // second 'path' element within the SVG HTML returned by 'toString':
  //
  //   const oOptsCode = { type: "svg" };
  //   const oCode = await gQRCode.toString("TEST", oOptsCode);
  //
  // That path can then be rendered with:
  //
  //   oDoc
  //     .save()
  //     .translate(oX, oY).path(oPath).stroke()
  //     .restore();
  //
  // Unfortunately, as documented here:
  //
  //   https://github.com/soldair/node-qrcode/issues/220
  //
  // the QR library constructs the path with lines, rather than boxes, so it
  // does not scale correctly. If they fix that, this can be greatly simplified.

  const oCode = await create(aText);
  const oDimCode = oCode.modules.size;

  if (oCode.modules.data.length != oDimCode * oDimCode)
    throw Error("print-web-order-labels wDraw_Barcode: Invalid QR data");

  const oSizeCell = aSize / oDimCode;
  for (let oXCell = 0; oXCell < oDimCode; ++oXCell)
    for (let oYCell = 0; oYCell < oDimCode; ++oYCell) {
      const oIdx = oYCell * oDimCode + oXCell;
      if (!oCode.modules.data[oIdx]) continue;

      const oX = aLeft + oXCell * oSizeCell;
      const oY = aTop + oYCell * oSizeCell;
      aDoc.rect(oX, oY, oSizeCell, oSizeCell);
    }
  aDoc.fill("black");
}
