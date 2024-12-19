// Flash.js
// ========
// Message Queue Management System
//
// Provides flash message functionality for displaying notifications across page loads.
// Key features:
// - Supports multiple queued messages
// - Works with or without page redirects
// - Handles both session and member-specific messages
//
// Related packages:
// - flash: https://github.com/expressjs/flash
// - express-flash: https://www.npmjs.com/package/express-flash
// - connect-flash: https://www.npmjs.com/package/connect-flash

import { Conn, wMembFromIDItCart } from "./Db.js";
import { NameProductVty } from "./Util.js";

/** Message container class with styling and content */
export class tFlash {
  constructor(aSty, aHead, aMsg) {
    /** Bootstrap alert style identifier */
    this.Sty = aSty;
    /** Optional message header */
    this.Head = aHead;
    /** Message content (supports HTML via hHTMLSafe) */
    this.Msg = aMsg;
  }
}

// Available Bootstrap Alert Styles:
// - primary: Main actions
// - secondary: Alternative actions
// - success: Successful operations
// - danger: Errors or warnings
// - warning: Caution notices
// - info: General information

/** Queues a session-scoped message for next page load.
 *  @param {string} aSty - Bootstrap alert style
 *  @param {string|null} aHead - Optional message header
 *  @param {string} aMsg - Message content (supports HTML via hHTMLSafe)
 */
function Show(aSty, aHead, aMsg) {
  if (!this.locals.Flashes) this.locals.Flashes = [];
  const oFlash = new tFlash(aSty, aHead, aMsg);
  this.locals.Flashes.push(oFlash);
}

/** Queues a member-specific message for their next page view.
 *  @param {number} aIDMemb - Target member ID
 *  @param {string} aSty - Bootstrap alert style
 *  @param {string|null} aHead - Optional message header
 *  @param {string} aMsg - Message content (supports HTML via hHTMLSafe)
 */
function Send(aIDMemb, aSty, aHead, aMsg) {
  if (aMsg === undefined) aMsg = "";

  const oSQL = `INSERT INTO FlashMemb (IDMemb, Sty, Head, Msg)
		VALUES (:IDMemb, :Sty, :Head, :Msg)`;
  // What happens if these values are too long for the fields?: [TO DO]
  const oData = {
    IDMemb: aIDMemb,
    Sty: aSty,
    Head: aHead,
    Msg: aMsg,
  };
  Conn.wExecPrep(oSQL, oData);
}

/** Express middleware for flash message processing.
 *  Initializes flash methods and transfers messages to view context.
 */
export async function wWare(aReq, aResp, aNext) {
  aResp.Show_Flash = Show;
  aResp.Send_Flash = Send;

  aResp.locals.Flashes = [];

  // Restore 'session' messages
  // --------------------------
  // Now that that 'member' messages have been implemented, it would be nice to
  // stop storing messages in the session table. However, some flash messages
  // are displayed before the user is known.

  if (aReq.session.Flashes) {
    aResp.locals.Flashes.push(...aReq.session.Flashes);
    delete aReq.session.Flashes;
  }

  // Restore 'member' messages
  // -------------------------

  // It would be wrong to check the effective member here. That would cause
  // messages to be displayed to impersonating staff members:
  if (aReq.user) {
    const oDatas = await wFlashes(aReq.user.IDMemb);
    const oFlashes = oDatas.map(oData => new tFlash(oData.Sty, oData.Head, oData.Msg));
    aResp.locals.Flashes.push(...oFlashes);

    if (oDatas.length) {
      const oIDMax = function (aIDMaxLast, aData) {
        return Math.max(aIDMaxLast, aData.IDFlashMemb);
      };

      const oIDFlashMembMax = oDatas.reduce(oIDMax, 0);
      await wDel_Flashes(aReq.user.IDMemb, oIDFlashMembMax);
    }
  }

  aNext();
}

/** Retrieves pending flash messages for a member
 *  @param {number} aIDMemb - Member ID
 *  @returns {Promise<Array>} List of pending messages
 */
async function wFlashes(aIDMemb) {
  const oSQL = "SELECT * FROM FlashMemb WHERE IDMemb = ?";
  const [oRows] = await Conn.wExecPrep(oSQL, [aIDMemb]);
  return oRows;
}

/** Removes processed flash messages for a member
 *  @param {number} aIDMemb - Member ID
 *  @param {number} aIDFlashMembMax - Highest processed message ID
 */
async function wDel_Flashes(aIDMemb, aIDFlashMembMax) {
  const oSQL = `DELETE FROM FlashMemb
		WHERE IDMemb = :IDMemb AND IDFlashMemb <= :IDFlashMembMax`;
  const oData = {
    IDMemb: aIDMemb,
    IDFlashMembMax: aIDFlashMembMax,
  };
  await Conn.wExecPrep(oSQL, oData);
}

/** Sends a product-specific message to a cart item's owner.
 *  Replaces $NameProductVty placeholder with actual product name.
 *  @param {number} aIDItCart - Cart item ID
 *  @param {string} aSty - Message style
 *  @param {string} aHead - Message header
 *  @param {string} aMsg - Message template
 */
export async function wSend_MsgItCart(aIDItCart, aSty, aHead, aMsg) {
  const oMemb = await wMembFromIDItCart(aIDItCart);
  const oProductVty = await wProductVtyFromIDItCart(aIDItCart);
  const oName = NameProductVty(oProductVty, oProductVty);
  const oTextMsg = aMsg.replace(/\$NameProductVty/g, oName);
  Send(oMemb.IDMemb, aSty, aHead, oTextMsg);
}

/** Retrieves product and variety details for a cart item
 *  @param {number} aIDItCart - Cart item ID
 *  @returns {Promise<Object|null>} Product and variety info if found
 */
async function wProductVtyFromIDItCart(aIDItCart) {
  const oSQL = `SELECT Product.*,
			Vty.*,
			IFNULL(zItCartVty.QtyProm, 0) AS QtyProm
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		LEFT JOIN (
			SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
			FROM Vty
			JOIN ItCart USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY Vty.IDVty
		) AS zItCartVty USING (IDVty)
		WHERE ItCart.IDItCart = ?`;
  const [oRows] = await Conn.wExecPrep(oSQL, [aIDItCart]);
  return oRows.length ? oRows[0] : null;
}
