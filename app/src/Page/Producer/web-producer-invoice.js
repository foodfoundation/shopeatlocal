// web-producer-invoice.js
// -----------------------
// Web Producer Invoice page controllers

import { Conn } from "../../Db.js";
import { TextIDInvcProducerWeb } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import { access } from "fs";

import { promisify } from "util";
// eslint-disable-next-line
const accessAsync = promisify(access);
import { Storage } from "../../Storage.js";

export async function wHandGet(aReq, aResp) {
  const oIDInvc = parseInt(aReq.params.IDInvcProducerWeb);
  const oInvc = await wInvcFromID(oIDInvc);
  if (!oInvc) {
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  if (!aReq.user.CkStaff()) {
    const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
    if (oInvc.IDProducer !== oIDProducer) {
      aResp.status(403);
      aResp.render("Misc/403");
      return;
    }
  }

  // Send file
  // ---------

  await Storage.files.sendFile(aResp, {
    fileName: oInvc.NameFileInvc,
    documentName:
      aReq.t("common:invoiceFilenames.webProducerInvoice", {
        name: CoopParams.CoopNameShort,
        id: TextIDInvcProducerWeb(oIDInvc),
      }) + ".pdf",
  });
}

async function wInvcFromID(aIDInvc) {
  const oSQL = `SELECT InvcProducerWeb.*
		FROM InvcProducerWeb
		WHERE IDInvcProducerWeb = :IDInvc`;
  const oParams = {
    IDInvc: aIDInvc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0] : null;
}
