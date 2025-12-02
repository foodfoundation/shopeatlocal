// on-site-producer-invoice.js
// ---------------------------
// On-site Producer Invoice page controllers

import { Conn } from "../../Db.js";
import { TextIDInvcProducerOnsite } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import { access } from "fs";

import { promisify } from "util";
// eslint-disable-next-line
const accessAsync = promisify(access);
import { Storage } from "../../Storage.js";

export async function wHandGet(aReq, aResp) {
  const oIDInvc = parseInt(aReq.params.IDInvcProducerOnsite);
  const oInvc = await wInvcFromID(oIDInvc);
  if (!oInvc) {
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  if (!aReq.user.CkStaff() && oInvc.IDProducer !== oIDProducer) {
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }

  // Send file
  // ---------

  await Storage.files.sendFile(aResp, {
    fileName: oInvc.NameFileInvc,
    documentName:
      aReq.t("common:invoiceFilenames.onSiteProducerInvoice", {
        name: CoopParams.CoopNameShort,
        id: TextIDInvcProducerOnsite(oIDInvc),
      }) + ".pdf",
  });
}

async function wInvcFromID(aIDInvc) {
  const oSQL = `SELECT InvcProducerOnsite.*
		FROM InvcProducerOnsite
		WHERE IDInvcProducerOnsite = :IDInvc`;
  const oParams = {
    IDInvc: aIDInvc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0] : null;
}
