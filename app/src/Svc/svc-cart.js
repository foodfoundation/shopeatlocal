// svc-cart.js
// -----------
// Cart Service Controllers

import { wLockBal_QtyProm } from "../Invt.js";
import { TemplFromFile } from "../View.js";
import {
  wCartOrCreate,
  wSummCart,
  wConnNew,
  wLock_StApp,
  PhaseBetw,
  wLock_CartOrCreate,
  wVtyFromID,
  wUpd_CdLocCart,
  wUpd_CdLocLastMemb,
  Conn,
} from "../Db.js";
import { tFlash } from "../Flash.js";
import { Add_FullPriceToVtyMutate, NameVty } from "../Util.js";

import handlebars from "handlebars";
const { compile } = handlebars;

/** Flash message generator
 *  @param {string} aHead - Flash message header
 *  @param {string} aMsg - Flash message text
 *  @returns {Object} Flash message object
 */
function FlashSucc(aHead, aMsg) {
  return new tFlash("success", aHead, aMsg);
}

/** Flash message generator
 *  @param {string} aHead - Flash message header
 *  @param {string} aMsg - Flash message text
 *  @returns {Object} Flash message object
 */
function FlashErr(aHead, aMsg) {
  return new tFlash("danger", aHead, aMsg);
}

/** Flash message generator
 *  @param {string} aHead - Flash message header
 *  @param {string} aMsg - Flash message text
 *  @returns {Object} Flash message object
 */
function _FlashWarn(aHead, aMsg) {
  return new tFlash("warning", aHead, aMsg);
}

/** GET handler for cart data
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Response with cart data or empty object
 */
export async function wHandGet(aReq, aResp) {
  // Check user authentication
  // -------------------------

  if (!aResp.locals.CredImperUser) {
    aResp.status(401);
    aResp.json(null);
    return;
  }
  const oIDMemb = aResp.locals.CredImperUser.IDMemb;

  // Get cart
  // --------

  const oCart = await wCartOrCreate(oIDMemb, aResp.locals.FlagShop);
  if (!oCart) {
    aResp.status(200);
    aResp.json("{}");
    return;
  }

  // Initialize view context
  aResp.locals.SummCartImperUser = await wSummCart(aResp.locals.CredImperUser, oCart);

  const oDataResp = {
    Flashes: [],
    ElsUpd: {
      "#SelCdLoc": ViewSelCdLoc(aResp.locals),
      "#SummCart": ViewSummCart(aResp.locals),
      "#LblBtnCart": ViewLblBtnCart(aResp.locals),

      // Insert the product 'OOS' line as well?
    },
  };

  aResp.status(200);
  aResp.json(JSON.stringify(oDataResp));
}

/** POST handler for cart updates
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Response with updated cart data
 *  @description Increments variety quantity or adds new variety to cart
 */
export async function wHandPost(aReq, aResp) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // We can't trust the data in aResp.locals, so we must re-query some values.

    // Check user authentication
    // -------------------------

    if (!aResp.locals.CredImperUser) {
      aResp.status(401);
      aResp.json(null);

      await oConn.wRollback();
      return;
    }
    const oIDMemb = aResp.locals.CredImperUser.IDMemb;
    const oIsMembEbtEligable = aResp.locals.CredImperUser.CdRegEBT === "Approv";

    const oIDVty = aReq.body.IDVty;
    if (!oIDVty) {
      aResp.status(400);
      aResp.json(null);

      await oConn.wRollback();
      return;
    }

    // Check shopping window
    // ---------------------

    const oStApp = await wLock_StApp(oConn);
    const oFlagShop = PhaseBetw(oStApp.CdPhaseCyc, "StartShop", "EndShop");
    if (!oFlagShop) {
      // Setting CkRefresh will cause the page to refresh; we do that to disable
      // Cart dialog inputs, '+1' buttons, et cetera. We must 'send' this
      // message rather than 'showing' it so that it appears after the refresh:
      aResp.Send_Flash(
        oIDMemb,
        "danger",
        "The shopping window has closed!",
        "You can no longer add items.",
      );

      aResp.status(200);
      aResp.json(JSON.stringify({ CkRefresh: true }));

      await oConn.wRollback();
      return;
    }

    // Get cart
    // --------

    const oCart = await wLock_CartOrCreate(oConn, oIDMemb, aResp.locals.FlagShop);
    if (!oCart) {
      aResp.status(200);
      aResp.json("{}");

      await oConn.wRollback();
      return;
    }

    // Update cart
    // -----------

    const oUpd = await wAdd_It(oCart, oIDVty, oConn);

    const oFlashes = [];
    const oVty = await wVtyFromID(oIDVty, oConn);
    Add_FullPriceToVtyMutate(oVty, oIsMembEbtEligable);

    if (oUpd.QtyAdd < 1)
      oFlashes.push(FlashErr("Could not add item.", "That variety is no longer available."));
    else {
      const oMsg =
        oUpd.QtyProm === 1
          ? `There is now 1 in your cart`
          : `There are now ${oUpd.QtyProm} in your cart`;
      oFlashes.push(FlashSucc(`Added '${NameVty(oVty)}'.`, oMsg));
    }

    // Initialize view context
    aResp.locals.SummCartImperUser = await wSummCart(aResp.locals.CredImperUser, oCart, oConn);

    if (aResp.locals.SummCartImperUser.QtyOrd === 1) {
      aResp.locals.ShowFirstItemInCartNotice = true;
    }

    const oDataResp = {
      Flashes: oFlashes.map(o => ViewFlash(o)),
      ElsUpd: {
        // No need to include the pickup location selector, it isn't changing.

        "#SummCart": ViewSummCart(aResp.locals),
        "#LblBtnCart": ViewLblBtnCart(aResp.locals),

        // Insert the product 'OOS' line as well?
      },
    };

    // See 'Compiled partials' in 'README.md' for more on this nonsense:
    oVty.CredUser = aResp.locals.CredUser;
    oVty.FlagShop = true;
    oDataResp.ElsUpd["#RowTblVty" + oIDVty] = ViewRowTblVty(oVty);
    oDataResp.ElsUpd["#CardFooterTblVty" + oIDVty] = ViewCardFooterTblVty(oVty);

    aResp.status(200);
    aResp.json(JSON.stringify(oDataResp));

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    // So that the pipline exception handler sends the usual 500 response:
    throw aErr;
  } finally {
    oConn.Release();
  }
}

/** PUT handler for cart replacement
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Response with replaced cart data
 *  @description Replaces entire cart content, treating blank quantities as zero
 */
export async function wHandPut(aReq, aResp) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // We can't trust the data in aResp.locals, so we must re-query some values.

    // Check user authentication
    // -------------------------

    if (!aResp.locals.CredImperUser) {
      aResp.status(401);
      aResp.json(null);

      await oConn.wRollback();
      return;
    }
    const oIDMemb = aResp.locals.CredImperUser.IDMemb;
    const oIsMembEbtEligable = aResp.locals.CredImperUser.CdRegEBT === "Approv";

    // Check shopping window
    // ---------------------

    const oStApp = await wLock_StApp(oConn);
    const oFlagShop = PhaseBetw(oStApp.CdPhaseCyc, "StartShop", "EndShop");
    if (!oFlagShop) {
      // Setting CkRefresh will cause the page to refresh; we do that to disable
      // Cart dialog inputs, '+1' buttons, et cetera. We must 'send' this
      // message rather than 'showing' it so that it appears after the refresh:
      aResp.Send_Flash(
        oIDMemb,
        "danger",
        "The shopping window has closed!",
        "You can no longer modify your cart.",
      );

      aResp.status(200);
      aResp.json(JSON.stringify({ CkRefresh: true }));

      await oConn.wRollback();
      return;
    }

    // Get cart
    // --------

    const oCart = await wLock_CartOrCreate(oConn, oIDMemb, aResp.locals.FlagShop);
    if (!oCart) {
      aResp.status(200);
      aResp.json("{}");

      await oConn.wRollback();
      return;
    }

    // Update location code
    // --------------------

    if (!aReq.body.CdLoc) {
      aResp.status(400);
      aResp.json(null);

      await oConn.wRollback();
      return;
    }
    await wUpd_CdLocCart(oCart.IDCart, aReq.body.CdLoc, oConn);
    oCart.CdLoc = aReq.body.CdLoc;

    await wUpd_CdLocLastMemb(oIDMemb, aReq.body.CdLoc, oConn);
    aResp.locals.CredImperUser.CdLocLast = aReq.body.CdLoc;

    // Update cart
    // -----------

    const oFlashes = [];

    for (const oIt of aReq.body.Its) {
      const oTextQtyOrd = oIt.QtyOrd.replace(/\D/g, "");
      const oQtyOrd = parseInt(oTextQtyOrd) || 0;
      const oNoteShop = oIt.NoteShop.trim() || null;
      oIt.Upd = await wUpd_Cart(oIt.IDItCart, oQtyOrd, oNoteShop, oConn);

      if (oQtyOrd < oIt.Upd.QtyOrdOrig) await wLockBal_QtyProm(oConn, oIt.IDVty);
      // No need to update ItDeliv or WgtLblOrdWeb, those tables have yet to be
      // filled.
      // Don't show the OOS warning unless more was ordered:
      else if (oQtyOrd > oIt.Upd.QtyOrdOrig && oQtyOrd > oIt.Upd.QtyProm) {
        const oVty = await wVtyFromID(oIt.IDVty, oConn);
        Add_FullPriceToVtyMutate(oVty, oIsMembEbtEligable);
        const oMsg =
          `Variety <strong>${oVty.NameProduct}, ` +
          `${NameVty(oVty)}</strong> is now out of stock.`;
        oFlashes.push(FlashErr("Could not add entire quantity.", oMsg));
      }
    }

    // Initialize view context
    aResp.locals.SummCartImperUser = await wSummCart(aResp.locals.CredImperUser, oCart, oConn);

    const oDataResp = {
      Flashes: oFlashes.map(o => ViewFlash(o)),
      ElsUpd: {
        // No need to include the pickup location selector, it isn't changing.

        "#SummCart": ViewSummCart(aResp.locals),
        "#LblBtnCart": ViewLblBtnCart(aResp.locals),

        // Insert the product 'OOS' line as well?
      },
    };

    for (const oIt of aReq.body.Its) {
      const oVty = await wVtyFromID(oIt.IDVty, oConn);
      Add_FullPriceToVtyMutate(oVty, oIsMembEbtEligable);
      // See 'Compiled partials' in 'README.md' for more on this nonsense:
      oVty.CredUser = aResp.locals.CredUser;
      oVty.FlagShop = true;
      oDataResp.ElsUpd[`#RowTblVty${oIt.IDVty}`] = ViewRowTblVty(oVty);
      oDataResp.ElsUpd["#CardFooterTblVty" + oIt.IDVty] = ViewCardFooterTblVty(oVty);
    }

    aResp.status(200);
    aResp.json(JSON.stringify(oDataResp));

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    // So that the pipline exception handler sends the usual 500 response:
    throw aErr;
  } finally {
    oConn.Release();
  }
}

/** Cart item quantity incrementer
 *  @param {Object} aCart - Cart object
 *  @param {string} aIDVty - Variety ID
 *  @param {Object} aConn - Database connection
 *  @returns {Promise<Object>} Updated inventory quantities
 */
async function wAdd_It(aCart, aIDVty, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = "CALL ItCart_Add(:IDCart, :IDVty)";
  const oData = {
    IDCart: aCart.IDCart,
    IDVty: aIDVty,
  };
  const [oOut] = await aConn.wExecPrep(oSQL, oData);
  if (!oOut.length || !oOut[0].length) throw Error("cart wAdd_It: Cannot get variety quantities");
  return oOut[0][0];
}

/** Cart item updater
 *  @param {string} aIDItCart - Cart item ID
 *  @param {number} aQtyOrd - New quantity
 *  @param {string} aNoteShop - Shopping note
 *  @param {Object} aConn - Database connection
 *  @returns {Promise<Object>} Updated inventory quantities
 */
async function wUpd_Cart(aIDItCart, aQtyOrd, aNoteShop, aConn) {
  // This procedure checks the note against the denied note, if any, and
  // prevents it from being re-set without a change:
  const oSQL = "CALL ItCart_Upd(:IDItCart, :QtyOrd, :NoteShop)";
  const oData = {
    IDItCart: aIDItCart,
    QtyOrd: aQtyOrd,
    NoteShop: aNoteShop,
  };
  const [oOut] = await aConn.wExecPrep(oSQL, oData);
  if (!oOut.length || !oOut[0].length) throw Error("cart wUpd_It: Cannot get variety quantities");
  return oOut[0][0];
}

/** A view that generates flash HTML. */
const ViewFlash = compile(TemplFromFile("Page/Misc/pFlash"));
/** A view that generates pickup location selector HTML. */
const ViewSelCdLoc = compile(TemplFromFile("Page/Shop/pSelCdLoc"));
/** A view that generates cart summary HTML. */
const ViewSummCart = compile(TemplFromFile("Page/Shop/pSummCart"));
/** A view that generates cart button label HTML. */
const ViewLblBtnCart = compile(TemplFromFile("Page/Shop/pLblBtnCart"));
/** A view that generates product variety table row HTML. */
const ViewRowTblVty = compile(TemplFromFile("Page/Shop/pRowTblVtyShop"));
/** TODO - add this comment later */
const ViewCardFooterTblVty = compile(TemplFromFile("Page/Shop/pCardFooterTblVtyShop"));
