// on-site-shopper-invoice.js
// --------------------------
// On-site Shopper Invoice page controllers
//
// This should be combined with 'web-shopper-invoice.js', from which it was
// adapted. [TO DO]

import { Conn } from "../../Db.js";
import { TextIDInvcProducerOnsite } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import { access } from "fs";

import { promisify } from "util";
// eslint-disable-next-line
const accessAsync = promisify(access);
import { Storage } from "../../Storage.js";

export async function wHandGet(aReq, aResp) {
  const oIDInvc = parseInt(aReq.params.IDInvcShopOnsite);
  const oInvc = await wInvcFromID(oIDInvc);
  if (!oInvc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  if (!aReq.user.CkStaff() && oInvc.IDMembShop !== oIDMemb) {
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }

  // Send file
  // ---------

  await Storage.files.sendFile(aResp, {
    fileName: oInvc.NameFileInvc,
    documentName: `${CoopParams.CoopNameShort} on-site shopper invoice ${TextIDInvcProducerOnsite(oIDInvc)}.pdf`,
  });
}

async function wInvcFromID(aIDInvc) {
  const oSQL = `SELECT InvcShopOnsite.*, CartOnsite.IDMembShop
		FROM InvcShopOnsite
		JOIN CartOnsite USING (IDCartOnsite)
		WHERE IDInvcShopOnsite = :IDInvc`;
  const oParams = {
    IDInvc: aIDInvc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0] : null;
}
