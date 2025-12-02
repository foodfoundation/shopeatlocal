// co-op-web-sales-by-location.js
// ------------------------------
/* Web Sales Location Analysis Controllers
 @module co-op-web-sales-by-location
 @requires Db
 @requires Util
 @requires Site
 @requires CSV
 */

import { Conn } from "../../Db.js";
import { TextIDCyc, TextCurr, Fmt_RowExcel } from "../../Util.js";
import { CoopParams } from "../../Site.js";

// This import is mandatory
import _gCSV from "../../CSV.js";

/** Returns the last cycle with a completed pickup window, or displays a flash
 * error message, redirects, and returns 'null', if that is not possible.
 *
 * @param {object} aReq - Request object
 * @param {object} aResp - Response object
 * @returns {object|null} Last cycle object or null
 */
function CycOrFlashErr(aReq, aResp) {
  if (aResp.PhaseCycGreaterEq("EndPickup")) return aResp.locals.CycCurr;

  if (!aResp.locals.CycPrev) {
    aResp.Show_Flash("danger", null, aReq.t("common:salesReports.cannotCompileNoCompletedWindow"));
    aResp.redirect(303, "/cashier");
    return null;
  }

  return aResp.locals.CycPrev;
}

/** Handles GET requests for web sales by location
 *
 * @param {object} aReq - Request object
 * @param {object} aResp - Response object
 */
export async function wHandGet(aReq, aResp) {
  const oCyc = CycOrFlashErr(aReq, aResp);
  if (!oCyc) return;
  aResp.locals.Cyc = oCyc;
  aResp.locals.Locations = await wLocs(oCyc.IDCyc);
  aResp.locals.Title = aReq.t("common:pageTitles.marketWebSalesByLocation", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("Cashier/co-op-web-sales-by-location");
}

/** Handles GET requests for exporting web sales by location
 *
 * @param {object} aReq - Request object
 * @param {object} aResp - Response object
 */
export async function wHandGetExport(aReq, aResp) {
  const oCyc = CycOrFlashErr(aReq, aResp);
  if (!oCyc) return;

  const oLocs = await wLocs(oCyc.IDCyc);
  for (const oLoc of oLocs) Fmt_RowExcel(oLoc);

  aResp.attachment(aReq.t("common:exportFilenames.webSalesByLocation") + ".csv");
  aResp.csv(oLocs, true);
}

/** Handles GET requests for exporting web sales by location for 10 cycles
 *
 * @param {object} aReq - Request object
 * @param {object} aResp - Response object
 */
export async function wHandGetExport10(aReq, aResp) {
  const oCyc = CycOrFlashErr(aReq, aResp);
  if (!oCyc) return;
  let currentCycInt = oCyc.IDCyc;
  //get last 10 cycles
  let cyclesBack = 10;
  let excelData = [];

  while (cyclesBack > 0) {
    const oLocs = await wLocs10(currentCycInt);
    for (const oLoc of oLocs) {
      //gUtil.Fmt_RowExcel(oLoc);
      excelData.push(oLoc);
      console.log(oLoc);
    }
    console.log(cyclesBack);
    cyclesBack -= 1;
    currentCycInt -= 1;
  }
  console.log(excelData);

  //export
  aResp.attachment(aReq.t("common:exportFilenames.webSalesByLocation10Cycles") + ".csv");
  aResp.csv(excelData, true);
}

/** Location data retriever for current cycle
 *  @param {string} aIDCyc - Cycle ID
 *  @returns {Promise<Array>} Location sales data aggregated by cart
 */
async function wLocs(aIDCyc) {
  const oSQL = `SELECT Cart.IDCyc AS Cycle, Loc.CdLoc, Loc.NameLoc, COUNT(DISTINCT Cart.IDCart) AS CtCart,
	SUM(ItCart.QtySold) AS QtySold, SUM(ItCart.SaleNom) AS SaleNom
	FROM ItCart
	JOIN Cart USING (IDCart)
	JOIN Loc USING (CdLoc)
	WHERE Cart.IDCyc = :IDCyc
	GROUP BY Loc.CdLoc, Cart.IDCyc
	ORDER BY CdLoc`;
  const oParams = {
    IDCyc: aIDCyc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Location data retriever for 10 cycles
 *  @param {string} aIDCyc - Cycle ID
 *  @returns {Promise<Array>} Location sales data for historical analysis
 */
async function wLocs10(aIDCyc) {
  const oSQL = `SELECT Cart.IDCyc AS Cycle, Loc.CdLoc, Loc.NameLoc, COUNT(DISTINCT Cart.IDCart) AS CtCart,
      SUM(ItCart.QtySold) AS QtySold, SUM(ItCart.SaleNom) AS SaleNom
    FROM ItCart
    JOIN Cart USING (IDCart)
    JOIN Loc USING (CdLoc)
    WHERE Cart.IDCyc = :IDCyc
    GROUP BY Loc.CdLoc, Cart.IDCyc
    ORDER BY CdLoc`;
  const oParams = {
    IDCyc: aIDCyc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
