// unblock-ip-address.js
// ---------------------
// Unblock IP Address controllers

import { wExec, CkFail, Retry } from "../../Form.js";
import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";
import { CtFailLoginBlock } from "../../../Cfg.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} unblock IP address`;
  aResp.locals.CtFailLoginBlock = CtFailLoginBlock;
  aResp.render("SiteAdmin/unblock-ip-address");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  const oFlds = {
    IP: { CkRequire: true, Valid: false },
  };

  await wExec(aReq.body, oFlds);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Unblock address
  // ---------------

  const oIP = oFlds.IP.ValCook;
  const oCtDel = await wUnblock_IP(oIP);

  // Return to form
  // --------------

  if (oCtDel)
    aResp.Show_Flash("info", null, `IP address <strong>${oIP}</strong> has been unblocked.`);
  else aResp.Show_Flash("danger", null, `IP address <strong>${oIP}</strong> was not blocked.`);

  aResp.redirect(303, "/unblock-ip-address");
}

/** Deletes all FailLogin records with the specified IP address, then returns
    the deleted record count. */
async function wUnblock_IP(aIP) {
  const oSQL = "DELETE FROM FailLogin WHERE IP = ?";
  const [oRows] = await Conn.wExecPrep(oSQL, [aIP]);
  return oRows.affectedRows;
}
