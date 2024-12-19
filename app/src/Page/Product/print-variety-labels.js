// print-variety-labels.js
// -----------------------
// Print Variety Labels page controllers

//const gLbl30 = require("../../Lbl30");
import { Metrics, wSend_LblsIt } from "../../Lbl.js";
import { wProductFromID, wProducerFromID, Conn } from "../../Db.js";
import { CkWgtVal, TextIDVty } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export const CtLblMax = Metrics.Def.CtPerPage * 50;

export async function wHandGet(aReq, aResp) {
  const oVty = aResp.locals.VtySel;
  const oProduct = await wProductFromID(oVty.IDProduct);
  const oProducer = await wProducerFromID(oProduct.IDProducer);
  if (aReq.query.Labels == "true") {
    const oParams = {
      Producer: oProducer.IDProducer,
    };
    const oSQL = `INSERT INTO ProducerLabelHistory (ProducerId, LabelType)
			VALUES (:Producer, True)`;
    const [_oRows] = await Conn.wExecPrep(oSQL, oParams);
  } else if (aReq.query.Labels == "false") {
    const oParams = {
      Producer: oProducer.IDProducer,
    };
    const oSQL = `INSERT INTO ProducerLabelHistory (ProducerId, LabelType)
			VALUES (:Producer, False)`;
    const [_oRows] = await Conn.wExecPrep(oSQL, oParams);
  }

  // Decode and validate parameters
  // ------------------------------

  let oWgts;
  let oQty;

  const oPathForm = "/variety-labels/" + oVty.IDVty;
  if (oVty.CkPriceVar) {
    if (aReq.query.Wgts) oWgts = aReq.query.Wgts.split(",").map(o => Number(o));

    if (!oWgts || !oWgts.length || oWgts.some(o => !CkWgtVal(o))) {
      aResp.redirect(303, oPathForm);
      return;
    }
  } else {
    if (aReq.query.Qty) oQty = Number(aReq.query.Qty);

    if (!oQty || oQty > CtLblMax) {
      aResp.redirect(303, oPathForm);
      return;
    }
  }

  // Generate and display labels
  // ---------------------------

  // Item data common to all labels:
  const oItBase = {
    ...oVty,
    ...oProduct,
    // We won't include all of oProducer, because it contains the producer first
    // and last name, which would be interpreted as the shopper name:
    IDProducer: oProducer.IDProducer,
    NameBus: oProducer.NameBus,
  };

  // Item elements, one per label, with label-specific data:
  const oIts = oVty.CkPriceVar
    ? oWgts.map(o => ({ ...oItBase, WgtPer: o }))
    : new Array(oQty).fill(oItBase);

  // This causes the PDF to be displayed in the browser, rather than downloaded:
  aResp.contentType("application/pdf");

  const oName = `${CoopParams.CoopNameShort} Variety ${TextIDVty(oVty.IDVty)} Labels.pdf`;
  // This sets the suggested filename if the user chooses to download the file,
  // without causing the download to start on its own:
  aResp.set("Content-Disposition", `inline; filename="${oName}"`);

  if (aReq.query.Labels == "true") {
    await wSend_LblsIt(aResp, oIts, true);
  } else {
    await wSend_LblsIt(aResp, oIts);
  }
}
