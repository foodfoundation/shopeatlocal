// Label Generation Module
// --------------------

/** Label metrics configuration for Avery 5160 format
 *  @constant {Object} Metrics
 *  @property {Object} Avery5160 - Avery 5160 label specifications
 *  @property {number} Avery5160.MargTop - Top margin (0.5", 36pt)
 *  @property {number} Avery5160.MargLeft - Left margin (3/16", 13.5pt)
 *  @property {number} Avery5160.WthLbl - Label width (2-5/8", 189pt)
 *  @property {number} Avery5160.HgtLbl - Label height (1" + 1pt, 73pt)
 *  @property {number} Avery5160.WthGutter - Gutter width (1/8", 9pt)
 *  @property {number} Avery5160.CtPerPage - Labels per page (30)
 */
export const Metrics = {
  /** Avery 5160 labels */
  Avery5160: {
    MargTop: 36, // 0.5"
    MargLeft: 13.5, // 3/16"
    WthLbl: 189, // 2-5/8"
    HgtLbl: 73, // 1" + 1.0pt
    WthGutter: 9, // 1/8"
    CtPerPage: 30,
  },
};

/** Default label configuration */
Metrics.Def = Metrics.Avery5160;
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
  let columnCount = 3;
  if (moreLbls) {
    oMetrics.CtPerPage = 30;
    oMetrics.HgtLbl = 57;
    oMetrics.MargTop = 15;
    columnCount = 3;
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
  if (moreLbls) {
    oOptsPage.layout = "landscape";
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
    if (moreLbls) {
      oRightLbl = oRightLbl - 130;
    }
    // Actually just past the bottom edge:
    const _oBtmLbl = oTopLbl + oMetrics.HgtLbl;

    const oPadX = 8;
    const oPadY = 8;

    let oLeftContent = oLeftLbl + oPadX;
    if (moreLbls) {
      //oLeftContent = oLeftContent / 1.1;
    }
    const oTopContent = oTopLbl + oPadY;

    let oSizeBarcode = 60;
    if (moreLbls) {
      oSizeBarcode = 49;
    }
    const oSpaceBarcode = oMetrics.HgtLbl;
    const oMargBarcode = (oSpaceBarcode - oSizeBarcode) / 2;
    const oLeftBarcode = oRightLbl - oSpaceBarcode + oMargBarcode;
    const oTopBarcode = oTopLbl + oMargBarcode;

    let oWthText = oLeftBarcode - oPadX - oLeftContent;
    if (moreLbls) {
      //oWthText = oWthText - 10;
    }

    let oSizeFontMain = 10;
    let oSizeFontNote = 8;
    if (moreLbls) {
      oSizeFontMain = 8;
      oSizeFontNote = 6;
    }

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
