// shopper-checkout.js
// -------------------
// Shopper Checkout page controllers

import { wExec } from "../../Checkout.js";
import {
  Unroll,
  wExec as _wExec,
  Roll,
  CkFail,
  ElsFromCollect,
  RecsByIDFromCollect,
} from "../../Form.js";
import { Locs, CoopParams } from "../../Site.js";
import { wMembFromID, wCartFromIDMemb, wConnNew, Conn } from "../../Db.js";
import { PageAfterCheckoutShop, TextIDMemb } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  // Check pickup window
  // -------------------

  if (!aResp.locals.FlagPickup) {
    const oMsg = aResp.PhaseCycLess("StartPickup")
      ? aReq.t("common:checkout.cannotCheckoutPickupNotStarted")
      : aReq.t("common:checkout.cannotCheckoutPickupClosed");
    aResp.Show_Flash("danger", null, oMsg);

    const oPage = PageAfterCheckoutShop(aReq, aResp);
    aResp.redirect(303, oPage);
    return;
  }

  // Check for previous checkout
  // ---------------------------

  const oIDMemb = aResp.locals.CredSel.IDMemb;
  const oMemb = await wMembFromID(oIDMemb);

  const oCart = await wCartFromIDMemb(oIDMemb);
  if (oCart.CdStatCart !== "Pend") {
    const oMsg = aReq.t("common:checkout.alreadyCheckedOut", { 
      firstName: oMemb.Name1First, 
      lastName: oMemb.Name1Last 
    });
    aResp.Show_Flash("danger", null, oMsg);

    const oPage = PageAfterCheckoutShop(aReq, aResp);
    aResp.redirect(303, oPage);
    return;
  }

  // Set various view parameters
  // ---------------------------

  aResp.locals.Memb = oMemb;
  aResp.locals.Cart = oCart;
  aResp.locals.Loc = Locs[oCart.CdLoc];

  // I don't trust non-manager staff to type quantities or weights:
  aResp.locals.CkAllowKbd = aReq.user.CkStaffMgr();

  aResp.locals.Stors = await wStors(oIDMemb);

  aResp.locals.VtyList = await getVtysByMemberCheckout(oIDMemb);

  // Render page
  // -----------

  aResp.locals.Title = aReq.t("common:pageTitles.shopperCheckout", { name: CoopParams.CoopNameShort });
  aResp.render("Distrib/shopper-checkout");
}

export async function wHandPost(aReq, aResp) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // Field-level validation
    // ----------------------

    const oFlds = {
      QtyLost: { Collect: "Vtys" },
      QtyReject: { Collect: "Vtys" },
      WgtPer: { Collect: "ItsPickup" },
      QtySold: { Collect: "ItsPickup" },
      CkNoShow: { CkRequire: true, Store: false },
    };

    const oFldsUnroll = Unroll(aReq.body, oFlds);
    await _wExec(aReq.body, oFldsUnroll);
    const oFldsRoll = Roll(oFldsUnroll);

    // If no items appear in the page, this array won't even be defined:
    if (!oFldsRoll.ItsPickup) {
      aResp.status(400);

      aResp.locals.Msg = aReq.t("common:checkout.noItemsToCheckout");
      aResp.render("Misc/400");

      await oConn.wRollback();
      return;
    }

    // Handle validation failure
    // -------------------------

    if (CkFail(oFldsUnroll)) {
      // It should be impossible to submit invalid data with this form, so we
      // will skip the user-friendly feedback:
      aResp.status(400);

      aResp.locals.Msg = aReq.t("common:checkout.validationFailure");
      aResp.render("Misc/400");

      await oConn.wRollback();
      return;
    }

    // Convert form data and check-out
    // -------------------------------
    // oFldsRoll.ItsPickup contains validated form specifications, collected
    // into records, and keyed by IDItPickup. Each record stores ItPickup form
    // data, keyed by field name, with ValCook giving the validated input.
    // gCheckout.wExec expects array elements resembling ordinary table data,
    // though only IDItPickup and QtySold or WgtPer are used.

    const oIDMemb = aResp.locals.CredSel.IDMemb;
    const oItsPickup = ElsFromCollect(oFldsRoll.ItsPickup, "IDItPickup");
    const oVtysByID = RecsByIDFromCollect(oFldsRoll.Vtys);
    const oCdStatCart = oFlds.CkNoShow.ValCook ? "NoShow" : "Pick";
    const oDataCheckout = await wExec(oConn, oIDMemb, oItsPickup, oVtysByID, oCdStatCart);

    // Handle checkout errors
    // ----------------------

    if (oDataCheckout.MsgFail === "OutWinPickup") {
      // In the message, we will ignore the possibility that the window has not
      // started.
      //
      // If the user leaves the page open until the next pickup window, the
      // ItCart and ItPickup IDs will fail to match, and 400 will be returned:
      const oMsg = aReq.t("common:checkout.pickupWindowClosed");
      aResp.Show_Flash("danger", null, oMsg);

      const oPage = PageAfterCheckoutShop(aReq, aResp);
      aResp.redirect(303, oPage);

      await oConn.wRollback();
      return;
    }

    if (oDataCheckout.MsgFail === "MismatchTtl") {
      const oMsg = aReq.t("common:checkout.orderTotalDiscrepancy");
      aResp.Show_Flash("danger", null, oMsg);

      aResp.redirect(303, `/shopper-checkout/${oIDMemb}`);

      await oConn.wRollback();
      return;
    }

    if (oDataCheckout.MsgFail === "NoCart") {
      aResp.status(400);

      aResp.locals.Msg = aReq.t("common:checkout.cannotGetCart", { id: TextIDMemb(oIDMemb) });
      aResp.render("Misc/400");

      await oConn.wRollback();
      return;
    }

    if (oDataCheckout.MsgFail === "DoneCart") {
      // This isn't an exceptional situation, so a flash message should be
      // displayed, not an error message: [TO DO]
      aResp.status(400);

      aResp.locals.Msg = aReq.t("common:checkout.cartAlreadyCheckedOut", { id: TextIDMemb(oIDMemb) });
      aResp.render("Misc/400");

      await oConn.wRollback();
      return;
    }

    if (oDataCheckout.MsgFail) {
      aResp.status(400);

      aResp.locals.Msg = aReq.t("common:checkout.checkoutFailed", { error: oDataCheckout.MsgFail });
      aResp.render("Misc/400");

      await oConn.wRollback();
      return;
    }

    // Return to Member Admin page
    // ---------------------------

    // const oMsg = "<strong>" + aResp.locals.CredSel.Name1First + " "
    // 	+ aResp.locals.CredSel.Name1Last + "</strong> has been checked out.";
    // aResp.Show_Flash("success", null, oMsg);

    const oPage = "/web-checkout-summary/" + oDataCheckout.IDInvc;
    aResp.redirect(303, oPage);

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    // So that the pipline exception handler sends the usual 500 response:
    throw aErr;
  } finally {
    oConn.Release();
  }
}

async function wStors(aIDMemb) {
  const oSQL = `SELECT ItPickup.IDItPickup, ItPickup.WgtPer,
			ItPickup.QtyDeliv, ItPickup.QtyLost, ItPickup.QtyReject, ItPickup.QtySold,
			ItCart.IDItCart, ItCart.NoteShop,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.CkInvtMgd, Vty.Upc,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct, Product.CdStor,
			Producer.IDProducer, Producer.NameBus
		FROM ItPickup
		JOIN ItCart USING (IDItCart)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE Cart.IDMemb = :IDMemb
		ORDER BY Product.CdStor,
			Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oIts] = await Conn.wExecPrep(oSQL, oParams);

  // Structure items
  // ---------------
  // Group item entries by storage code and variety. Variable-price ItPickup
  // records are already split into unit quantities.

  const oStors = [];

  let oStorLast;
  let oVtyLast;
  for (const oIt of oIts) {
    if (!oStorLast || oIt.CdStor != oStorLast.CdStor) {
      oStorLast = {
        CdStor: oIt.CdStor,
        Vtys: [],
      };
      oStors.push(oStorLast);
    }

    if (!oVtyLast || oIt.IDVty != oVtyLast.IDVty) {
      oVtyLast = {
        IDItCart: oIt.IDItCart,
        IDProducer: oIt.IDProducer,
        NameBus: oIt.NameBus,
        IDProduct: oIt.IDProduct,
        NameProduct: oIt.NameProduct,
        IDVty: oIt.IDVty,
        Kind: oIt.Kind,
        Size: oIt.Size,
        WgtMin: oIt.WgtMin,
        WgtMax: oIt.WgtMax,
        CkInvtMgd: oIt.CkInvtMgd,
        CkPriceVar: oIt.CkPriceVar,
        NoteShop: oIt.NoteShop,
        // To be incremented below:
        QtyDeliv: 0,
        // To be incremented below:
        QtyLost: 0,
        // To be incremented below:
        QtyReject: 0,
        Its: [],
        Upc: oIt.Upc,
      };
      oStorLast.Vtys.push(oVtyLast);
    }

    // There will be one such record if the price is fixed, or a number equal to
    // the delivered quantity if it is variable:
    oVtyLast.Its.push({
      IDItPickup: oIt.IDItPickup,
      // This is NULL by default, and the form expects a quantity value:
      QtySold: oIt.QtySold || 0,
      // The form does not expect a value for unset weights:
      WgtPer: oIt.WgtPer,
    });

    // These are split in the table, so they must be collected here:
    oVtyLast.QtyDeliv += oIt.QtyDeliv;
    oVtyLast.QtyLost += oIt.QtyLost;
    oVtyLast.QtyReject += oIt.QtyReject;
  }

  return oStors;
}

async function getVtysByMemberCheckout(aIDMemb) {
  const oSQL = `SELECT ItPickup.IDItPickup, ItPickup.WgtPer,
		ItPickup.QtyDeliv, ItPickup.QtyLost, ItPickup.QtyReject, ItPickup.QtySold,
		ItCart.IDItCart, ItCart.NoteShop,
		Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.CkInvtMgd, Vty.Upc,
		IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
		Product.IDProduct, Product.NameProduct, Product.CdStor,
		Producer.IDProducer, Producer.NameBus
	FROM ItPickup
	JOIN ItCart USING (IDItCart)
	JOIN Cart USING (IDCart)
	JOIN StApp USING (IDCyc)
	JOIN Vty USING (IDVty)
	JOIN Product USING (IDProduct)
	JOIN Producer USING (IDProducer)
	WHERE Cart.IDMemb = :IDMemb
	ORDER BY Product.CdStor,
		Producer.NameBus, Producer.IDProducer,
		Product.NameProduct, Product.IDProduct,
		Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oIts] = await Conn.wExecPrep(oSQL, oParams);
  return oIts;
}
