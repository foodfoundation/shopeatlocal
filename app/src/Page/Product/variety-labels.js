// variety-labels.js
// -----------------
// Variety Labels page controllers

import { CtLblMax } from "./print-variety-labels.js";
import {
  Valid as _Valid,
  Unroll,
  wExec,
  Roll,
  ValsFromCollect,
  CkFail,
  Retry,
} from "../../Form.js";
import { wProductFromID, wProducerFromID } from "../../Db.js";
import { CoopParams } from "../../Site.js";
import { access, constants, writeFile, appendFile } from "fs";

export async function wHandGet(aReq, aResp) {
  const oVty = aResp.locals.VtySel;
  const oProduct = await wProductFromID(oVty.IDProduct);
  const oProducer = await wProducerFromID(oProduct.IDProducer);

  aResp.locals.Title = `${CoopParams.CoopNameShort} variety labels`;
  aResp.locals.Product = oProduct;
  aResp.locals.Producer = oProducer;
  aResp.render("Product/variety-labels");
}

export async function wHandPost(aReq, aResp) {
  const oVty = aResp.locals.VtySel;

  function _logError(message) {
    const errorFilePath = "errors.txt";

    // Checking to see if error file exist: errorFilePath
    access(errorFilePath, constants.F_OK, err => {
      if (err) {
        // File does not exist, create it
        writeFile(errorFilePath, "", _err => {});
      }

      // Writing error to errors file: errorFilePath
      appendFile(errorFilePath, message, err => {
        if (err) {
          console.error(err);
        }
      });
    });
  }
  //logError("Hello");

  // Field-level validation
  // ----------------------
  function oValid_Qty(aFld) {
    _Valid.Gen.QtyNonZero(aFld);
    if (aFld.MsgFail) return;

    if (aFld.ValCook > CtLblMax)
      aFld.MsgFail = `You cannot print more than ${CtLblMax} labels at a time`;
  }

  const oFlds = {};

  if (oVty.CkPriceVar)
    oFlds.WgtPer = {
      Collect: "Its",
    };
  else
    oFlds.Qty = {
      Valid: oValid_Qty,
      CkRequire: true,
      Collect: false,
    };
  oFlds.label = {};
  const oFldsUnroll = Unroll(aReq.body, oFlds);

  //logError(JSON.stringify(oFldsUnroll));
  //logError(JSON.stringify(aReq.body));
  //logError(JSON.stringify(aReq.body.labels));

  await wExec(aReq.body, oFldsUnroll);
  const oFldsRoll = Roll(oFldsUnroll);

  // Extract weight entries
  // ----------------------

  // ValsFromCollect ignores empty collections, so we needn't check CkPriceVar:
  let {
    ValsRaw: oWgtsRaw,
    ValsCook: oWgtsCook,
    MsgFail: oMsgFailWgts,
  } = ValsFromCollect(oFldsRoll.Its, "WgtPer");

  // Empty inputs will have 'null' cooked values:
  oWgtsCook = oWgtsCook.filter(o => o !== null);

  if (oVty.CkPriceVar && !oWgtsCook.length) oMsgFailWgts = "Test";

  // Handle validation failure
  // -------------------------
  // It might be nice to reject weight values that are well outside the
  // expected range, but I don't think that is MVP.

  if (CkFail(oFldsUnroll) || oMsgFailWgts) {
    Retry(aResp, oFldsUnroll);

    aResp.locals.WgtsFulf = oWgtsRaw;
    aResp.locals.MsgFailWgts = oMsgFailWgts;

    wHandGet(aReq, aResp);
    return;
  }

  // Redirect to Print page
  // ----------------------
  // Originally, I used gLbl.wSend_LblsIt to stream the PDF output from this
  // controller, but that did not work correctly in Chrome. The PDF appeared in
  // the Chrome PDF viewer as expected, but when I clicked the download button
  // in that viewer, the download failed with the message "Failed - Network
  // error". If I then clicked the Resume entry in the menu associated with the
  // download, it would appear to work, but the downloaded file contained the
  // HTML of this form, not the PDF. This all worked fine in Firefox. The other
  // PDF controllers worked correctly in both browsers, but they do not use
  // forms to generate PDFs on-demand, as this one does.
  //
  // Since it is idempotent, I guess it is reasonable to access this type of
  // resource with GET and a query string, rather than a POST. It will also
  // allow label pages to be bookmarked.

  const oParams = {};
  if (oVty.CkPriceVar) oParams.Wgts = oWgtsCook;
  else oParams.Qty = oFlds.Qty.ValCook;

  oParams.Labels = aReq.body.labels;

  const oQuery = new URLSearchParams(oParams).toString();
  const oPath = `/print-variety-labels/${oVty.IDVty}?${oQuery}`;
  aResp.redirect(303, oPath);
}
