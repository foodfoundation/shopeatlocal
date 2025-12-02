// producer-check-in.js
// --------------------
// Producer Check-in page controllers

import { wExec } from "../../CheckIn.js";
import { Unroll, wExec as _wExec, Roll, MsgFail, ElsFromCollect } from "../../Form.js";
import { wProducerFromID, wConnNew, Conn } from "../../Db.js";
import { PageAfterCheckInProducer } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // Check delivery window
  // ---------------------

  if (!aResp.locals.FlagDeliv) {
    const oMsg = aResp.PhaseCycLess("StartDeliv")
      ? aReq.t("common:checkIn.cannotCheckInDeliveryNotStarted")
      : aReq.t("common:checkIn.cannotCheckInDeliveryClosed");
    aResp.Show_Flash("danger", null, oMsg);

    const oPage = PageAfterCheckInProducer(aReq, aResp);
    aResp.redirect(303, oPage);
    return;
  }

  // Set various view parameters
  // ---------------------------

  const oIDProducer = aResp.locals.CredSel.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  // I don't trust non-manager staff to type quantities or weights. However,
  // Jennifer asked that all staff be allowed to do this, at least when
  // checking-in. Shopper checkout still requires that items be scanned when the
  // user is not a manager:
  //
  aResp.locals.CkAllowKbd = true;
  //
  // To limit to managers only:
  //
  //   aResp.locals.CkAllowKbd = aReq.user.CkStaffMgr();
  //

  // Structure item data
  // -------------------
  // Group item entries by variety and product. Variable-price ItDeliv records
  // are already split into unit quantities.

  aResp.locals.Products = [];

  let oProductLast;
  let oVtyLast;
  const oIts = await wIts(oIDProducer);
  aResp.locals.Vtylist = oIts;

  for (const oIt of oIts) {
    if (!oProductLast || oIt.IDProduct != oProductLast.IDProduct) {
      oProductLast = {
        IDProduct: oIt.IDProduct,
        NameProduct: oIt.NameProduct,
        Vtys: [],
      };
      aResp.locals.Products.push(oProductLast);
    }

    if (!oVtyLast || oIt.IDVty != oVtyLast.IDVty || oIt.IDItCart != oVtyLast.IDItCart) {
      oVtyLast = {
        IDVty: oIt.IDVty,
        Kind: oIt.Kind,
        Size: oIt.Size,
        WgtMin: oIt.WgtMin,
        WgtMax: oIt.WgtMax,
        CkInvtMgd: oIt.CkInvtMgd,
        CkPriceVar: oIt.CkPriceVar,
        IDItCart: oIt.IDItCart,
        NoteShop: oIt.NoteShop,
        IDMembShop: oIt.IDMembShop,
        NameFirstShop: oIt.NameFirstShop,
        NameLastShop: oIt.NameLastShop,
        // To be incremented below:
        QtyProm: 0,
        // To be incremented below:
        QtyTruant: 0,
        Its: [],
      };
      oProductLast.Vtys.push(oVtyLast);
    }

    // There will be one such record if the price is fixed, or a number equal to
    // the promised quantity if it is variable:
    oVtyLast.Its.push({
      IDItDeliv: oIt.IDItDeliv,
      // This is NULL by default, and the form expects a quantity value:
      QtyDeliv: oIt.QtyDeliv || 0,
      // The form does not expect a value for unset weights:
      WgtPer: oIt.WgtPer,
    });

    // These are split in the table, so they must be collected here:
    oVtyLast.QtyProm += oIt.QtyProm;
    oVtyLast.QtyTruant += oIt.QtyTruant;
  }

  // Render page
  // -----------

  aResp.locals.Title = aReq.t("common:pageTitles.producerCheckIn", { name: CoopParams.CoopNameShort });
  aResp.locals.CoopParams = CoopParams;
  aResp.render("Distrib/producer-check-in");
}

export async function wHandPost(aReq, aResp) {
  // No need to check for item ownership here, as we do in the Producer
  // Inventory, because this page is served only to staff.

  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // Field-level validation
    // ----------------------
    // Apparently, the truant quantity in the form is used only on the client
    // side.
    //
    // Note that this validation check is performed inside the transaction.

    const oFlds = {
      WgtPer: { Collect: "ItsDeliv" },
      QtyDeliv: { Collect: "ItsDeliv" },
    };

    const oFldsUnroll = Unroll(aReq.body, oFlds);
    await _wExec(aReq.body, oFldsUnroll);
    const oFldsRoll = Roll(oFldsUnroll);

    // If no items appear in the page, this array won't even be defined:
    if (!oFldsRoll.ItsDeliv) {
      await oConn.wRollback();

      aResp.status(400);
      aResp.locals.Msg = aReq.t("common:checkIn.noItemsToCheckIn");
      aResp.render("Misc/400");
      return;
    }

    // Handle validation failure
    // -------------------------

    const oMsgFailValid = MsgFail(oFldsUnroll);
    if (oMsgFailValid) {
      await oConn.wRollback();

      // It should be impossible to submit invalid data with this form, so we will
      // skip the user-friendly feedback:
      aResp.status(400);
      aResp.locals.Msg = aReq.t("common:checkIn.validationFailure", { error: oMsgFailValid });
      aResp.render("Misc/400");
      return;
    }

    // Convert form data and check-in
    // ------------------------------
    // oFldsRoll.ItsDeliv contains field objects keyed by IDItDeliv. Each object
    // contains form data keyed by field name, with ValCook giving the validated
    // input. gCheckIn.wExec expects array elements resembling ordinary table
    // data, though only IDItDeliv and QtyDeliv or WgtPer are required.

    const oIDProducer = aResp.locals.CredSel.IDProducer;
    const oItsDeliv = ElsFromCollect(oFldsRoll.ItsDeliv, "IDItDeliv");
    const oDataCheckIn = await wExec(oConn, oIDProducer, oItsDeliv);

    // Handle check-in errors
    // ----------------------

    if (oDataCheckIn.MsgFail === "OutWinDeliv") {
      await oConn.wRollback();

      // We will ignore the possibility that the window has not started.
      //
      // If the user leaves the page open until the next delivery window, the
      // ItCart and ItDeliv IDs will fail to match, and 400 will be returned:
      const oMsg = aReq.t("common:checkIn.deliveryWindowClosed");
      aResp.Show_Flash("danger", null, oMsg);

      const oPage = PageAfterCheckInProducer(aReq, aResp);
      aResp.redirect(303, oPage);
      return;
    }

    if (oDataCheckIn.MsgFail === "Dirty") {
      await oConn.wRollback();

      const oMsg = aReq.t("common:checkIn.inventoryUpdatedDuringCheckIn");
      aResp.Show_Flash("danger", null, oMsg);

      const oPage = "/producer-check-in/" + oIDProducer;
      aResp.redirect(303, oPage);
      return;
    }

    if (oDataCheckIn.MsgFail) {
      await oConn.wRollback();

      aResp.status(400);
      aResp.locals.Msg = aReq.t("common:checkIn.checkInError", { error: oDataCheckIn.MsgFail });
      aResp.render("Misc/400");
      return;
    }

    // Return to Producer Admin page
    // -----------------------------

    // const oMsg = "<strong>" + aResp.locals.CredSel.NameBusProducer
    // 	+ "</strong> has been checked-in.";
    // aResp.Show_Flash("success", null, oMsg);

    const oPage = "/producer-check-in-summary/" + oDataCheckIn.IDInvc;
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

async function wIts(aIDProducer) {
  const oSQL = `SELECT ItDeliv.*,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.CkInvtMgd, Vty.Upc,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct,
			IF(ItCart.NoteShop IS NULL, NULL, ItCart.IDItCart) AS IDItCart,
			ItCart.NoteShop,
			Memb.IDMemb AS IDMembShop, Memb.Name1First AS NameFirstShop,
			Memb.Name1Last AS NameLastShop
		FROM ItDeliv
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN StApp ON StApp.IDCyc = ItDeliv.IDCyc
		LEFT JOIN ItCart USING (IDItCart)
		LEFT JOIN Cart USING (IDCart)
		LEFT JOIN Memb USING (IDMemb)
		WHERE IDProducer = :IDProducer
			AND ItDeliv.QtyProm > 0
		ORDER BY Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
