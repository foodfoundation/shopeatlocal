// cycle history.js
// ----------------
// Cycle History page controllers

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Cycs = await wCycs();

  // Render page
  // -----------

  aResp.locals.Title = aReq.t("common:pageTitles.cycleHistory", { name: CoopParams.CoopNameShort });
  aResp.render("Distrib/cycle-history");
}

async function wCycs(aIDCyc) {
  const oSQL = `SELECT *
		FROM Cyc
		WHERE WhenStartCyc < NOW()
		ORDER BY IDCyc DESC`;
  const oParams = {
    IDCyc: aIDCyc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
