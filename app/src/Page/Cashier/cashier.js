/** Cashier Interface Controllers
 *  @module cashier
 *  @requires Search
 *  @requires Site
 */

import { PathQuery, NamesParamTransact } from "../../Search.js";
import { CoopParams } from "../../Site.js";

/** GET handler for cashier interface
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Renders cashier view
 */
export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.cashier", { name: CoopParams.CoopNameShort });
  aResp.render("Cashier/cashier");
}

/** POST handler for transaction search
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @description Processes search parameters and redirects to results
 */
export function HandPost(aReq, aResp) {
  const oPath = PathQuery("/transaction-search-results", aReq.body, NamesParamTransact);
  aResp.redirect(303, oPath);
}
