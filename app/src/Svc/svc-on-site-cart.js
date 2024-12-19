/** On-site Cart Service Controllers
 *  @module svc-on-site-cart
 *  @requires handlebars
 *  @requires View
 *  @requires Flash
 *  @requires Util
 */

import handlebars from "handlebars";
const { compile } = handlebars;

import { TemplFromFile } from "../View.js";
import { tFlash } from "../Flash.js";
import { TextIDVty } from "../Util.js";

/** Error flash message generator
 *  @param {string} aHead - Message header
 *  @param {string} aMsg - Message content
 *  @returns {tFlash} Flash message instance
 */
function FlashErr(aHead, aMsg) {
  return new tFlash("danger", aHead, aMsg);
}

/** GET handler for variety line data
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Response with variety data and HTML
 */
export async function wHandGet(aReq, aResp) {
  let oMsgFail = null;

  const oVtySel = aResp.locals.VtySel;
  if (!oVtySel) oMsgFail = `Variety ${TextIDVty(aReq.params.IDVtySel)} is not recognized.`;

  // We used to reject varieties that were not approved for on-site sale. To
  // support leftover items (and who knows what else) we will allow them
  // instead.

  const oVtySend = oMsgFail ? null : { IDVty: oVtySel.IDVty, CkPriceVar: oVtySel.CkPriceVar };

  // Prepare messages and views
  // --------------------------

  let oHTMLLine = null;
  const oFlashes = [];

  if (oMsgFail) oFlashes.push(FlashErr("Could not add item.", oMsgFail));
  else oHTMLLine = ViewLine(oVtySel);

  // Send response
  // -------------

  const oDataResp = {
    Flashes: oFlashes.map(o => ViewFlash(o)),
    ElsAppd: {},
    Data: {
      Vty: oVtySend,
    },
  };

  if (oHTMLLine) oDataResp.ElsAppd["#Vtys"] = [oHTMLLine];

  aResp.status(200);
  aResp.json(JSON.stringify(oDataResp));
}

/** Flash message template compiler
 *  @type {Function}
 */
const ViewFlash = compile(TemplFromFile("Page/Misc/pFlash"));

/** Cart line template compiler
 *  @type {Function}
 */
const ViewLine = compile(TemplFromFile("Page/Onsite/pLineCartOnsite"));
