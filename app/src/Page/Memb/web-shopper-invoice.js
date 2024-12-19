// web-shopper-invoice.js
// -----------------------
// Web Shopper Invoice page controllers

import { Conn } from "../../Db.js";
import { TextIDInvcShopWeb } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import { access } from "fs";

import { promisify } from "util";
// eslint-disable-next-line
const accessAsync = promisify(access);
import { Storage } from "../../Storage.js";

export async function wHandGet(aReq, aResp) {
  const oIDInvc = parseInt(aReq.params.IDInvcShopWeb);
  const oInvc = await wInvcFromID(oIDInvc);
  if (!oInvc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  if (!aReq.user.CkStaff() && oInvc.IDMemb !== oIDMemb) {
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }

  // Send file
  // ---------

  await Storage.files.sendFile(aResp, {
    fileName: oInvc.NameFileInvc,
    documentName: `${CoopParams.CoopNameShort} web shopper invoice ${TextIDInvcShopWeb(oIDInvc)}.pdf`,
  });
}

async function wInvcFromID(aIDInvc) {
  const oSQL = `SELECT InvcShopWeb.*,
			Cart.IDMemb
		FROM InvcShopWeb
		JOIN Cart USING (IDCart)
		WHERE IDInvcShopWeb = :IDInvc`;
  const oParams = {
    IDInvc: aIDInvc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0] : null;
}
