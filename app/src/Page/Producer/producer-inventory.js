// producer-inventory.js
// ---------------------
// Producer Inventory page controllers

import { wLockBal_QtyProm, wLockUpd_ItDeliv, wLockUpd_WgtLblOrdWeb } from "../../Invt.js";
import { wSend_MsgItCart } from "../../Flash.js";
import { Unroll, wExec, Roll, CkFail, wUpdOne } from "../../Form.js";
import {
  wInvcProducerWeb,
  wConnNew,
  wLock_StApp,
  wLock_InvcProducerWeb,
  wVtyFromID,
  PhaseCycLess,
  CdsListVtyValid,
  CksFromCdListVty,
  PhaseCycGreater,
  PhaseBetw,
  Conn,
  CdListVtyFromCks,
} from "../../Db.js";
import { Add_PropsProduct } from "../../Util.js";
import { CoopParams } from "../../Site.js";

/** Returns an object containing fields that should be disabled in the form. */
function FldsDisab(aReq, aResp, aProducts, aCkCheckIn) {
  const oFlds = {};
  let isDelivery = false;
  if (aResp.PhaseCycEq("StartDeliv") || aResp.PhaseCycEq("EndDeliv")) {
    isDelivery = true;
  }

  for (const oProduct of aProducts) {
    for (const oVty of oProduct.Vtys) {
      if (oVty.CkInvtMgd && !aReq.user.CkStaff()) {
        oFlds["CdListVty" + oVty.IDVty] = {};
        oFlds["QtyOffer" + oVty.IDVty] = {};
      }

      if (isDelivery) {
        oFlds["QtyOffer" + oVty.IDVty] = {};
      }

      if (aResp.locals.FlagDeliv && aCkCheckIn) oFlds["QtyOffer" + oVty.IDVty] = {};

      if (aCkCheckIn)
        for (const oNoteShop of oVty.NotesShop) oFlds["CkDenyNoteShop" + oNoteShop.IDItCart] = {};
    }
  }

  if (aResp.PhaseCycEq("StartDeliv") || aResp.PhaseCycEq("EndDeliv")) {
    oFlds.QtyOffer = {
      Msg: aReq.t("common:inventory.cannotChangeWebInventoryDuringDelivery"),
    };
  }
  return oFlds;
}

export async function wHandGet(aReq, aResp) {
  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  const oProducts = await wProducts(oIDProducer);

  // Add category/subcategory name combinations
  // ------------------------------------------

  oProducts.forEach(o => {
    o.TextCatSubcat = `${o.NameCat}: ${o.NameSubcat}`;
  });

  // Add variety records
  // -------------------
  // It would be faster to query the products and varieties together, and then
  // 'roll' them up here, to produce the product/variety structure that the view
  // expects. However, I don't see a way to do that with the notes, at least not
  // without dividing the quantities by note, which we do not want.

  const oTasksVty = oProducts.map(async oProduct => {
    oProduct.Vtys = await wVtys(oProduct.IDProduct);
  });
  await Promise.all(oTasksVty);

  // Add note records
  // ----------------

  const oTasksNoteShop = [];
  oProducts.forEach(async oProduct => {
    const oTasks = oProduct.Vtys.map(async oVty => {
      oVty.NotesShop = await wNotesShopActiv(oVty.IDVty);
    });
    oTasksNoteShop.push(...oTasks);
  });
  await Promise.all(oTasksNoteShop);

  // Add product properties
  // ----------------------

  Add_PropsProduct(oProducts);
  aResp.locals.Products = oProducts;

  // Render page
  // -----------

  const oCkCheckIn = (await wInvcProducerWeb(oIDProducer)) !== null;
  aResp.locals.CkCheckIn = oCkCheckIn;

  aResp.locals.FldsDisab = FldsDisab(aReq, aResp, oProducts, oCkCheckIn);

  aResp.locals.Title = aReq.t("common:pageTitles.producerInventory", { name: CoopParams.CoopNameShort });
  aResp.render("Producer/producer-inventory");
}

export async function wHandPost(aReq, aResp) {
  // As mentioned in 'README.md', the great number of queries in this request
  // make it very slow when the server runs locally. This could be improved
  // somewhat (without moving the update process to a stored procedure) by
  // setting flags in the form that indicate which records require updates. It
  // runs so fast when the app is on the server, I don't think that is worth the
  // bother.
  //
  // The explicit locks I added recently block the product search while this
  // request is being handled. I don't like that, but I don't have time to do
  // anything about it. If the product search could be made to ignore the ItCart
  // table, the problem might go away. On the test server, even when updating
  // the producer account (with almost 300 products) the delay is no more
  // than a second, so perhaps no one will notice. [OPTIMIZE]

  // Field-level validation
  // ----------------------

  // Notice that 'Vtys' collection elements apply to an entire variety, while
  // 'ItsCart' elements apply to specific items within some variety:
  const oFlds = {
    QtyOffer: { Collect: "Vtys" },
    CdListVty: { Collect: "Vtys", Store: false },
    CkDenyNoteShop: { Valid: false, Store: false, Collect: "ItsCart" },
  };

  const oFldsUnroll = Unroll(aReq.body, oFlds);
  // It's difficult to use FldsDisab here, because we don't have the same
  // product data. We will check for unwanted fields in the form-level
  // validation:
  await wExec(aReq.body, oFldsUnroll);
  const oFldsRoll = Roll(oFldsUnroll);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFldsUnroll)) {
    // It should be impossible to submit invalid data with this form, so we will
    // skip the user-friendly feedback. See 'edit-cycle-times' for an example if
    // that is needed later:
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  // Start verify/update transaction
  // -------------------------------
  // Would it be better to lock and commit changes one variety at a time?
  // [OPTIMIZE]

  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    const oStApp = await wLock_StApp(oConn);

    const oCkStaff = aReq.user.CkStaff();
    const oIDProducer = aResp.locals.CredImperUser.IDProducer;
    // Used to identify a producer check-in:
    const oInvcProducer = await wLock_InvcProducerWeb(oConn, oIDProducer);

    // We are updating varieties and cart items separately, so we must lock
    // everything in advance. I would prefer to lock after validation, but
    // keeping this near the other locks may avoid deadlocks:
    await wLock_ProductsVtysItsCart(oConn, oIDProducer);

    // Verify data
    // -----------
    // These are not 'validation' checks, first because they do not use MsgFail
    // or any other part of the validation feedback system, and second because
    // some of them belong in the transaction.
    //
    // Be sure you understand what the producer is allowed to do with this form,
    // and when they can do it:
    //
    // ~ The producer can always change listing statuses;
    //
    // ~ Before they check-in, they can change offer quantities, and deny or
    //   un-deny notes;
    //
    // ~ After they check-in, and for the rest of the delivery window, they
    //   cannot change offer quantities or notes;
    //
    // ~ When the delivery window ends, they can change offer quantities, but
    //   these changes will actually target the next cycle's quantities. They
    //   cannot deny, un-deny, or even see this cycle's notes.
    //
    // It is very easy to get this wrong! When testing this page, be sure to
    // POST changes before check-in, after check-in but before the delivery
    // window ends, and after the delivery window. Also test with 'stale' pages
    // that were opened before these boundary times and submitted after.
    //
    // Recall that inputs disabled in the form will not appear in oFldsRoll.

    // If no varieties appear in the page, this array won't even be defined. It
    // is okay for ItsCart to be undefined, however:
    if (!oFldsRoll.Vtys) {
      await oConn.wRollback();

      aResp.status(400);
      aResp.locals.Msg = aReq.t("common:inventory.noVarietiesToUpdate");
      aResp.render("Misc/400");
      return;
    }

    // Check varieties
    // ···············

    for (const oIDVty in oFldsRoll.Vtys) {
      const oFldsVty = oFldsRoll.Vtys[oIDVty];

      const oVtyOrig = await wVtyFromID(oIDVty, oConn);
      if (!oVtyOrig) {
        await oConn.wRollback();

        aResp.status(400);
        aResp.locals.Msg = aReq.t("common:inventory.invalidVarietyId", { id: oIDVty });
        aResp.render("Misc/400");
        return;
      }

      if (oVtyOrig.IDProducer !== oIDProducer && !oCkStaff) {
        await oConn.wRollback();

        aResp.status(400);
        aResp.locals.Msg = aReq.t("common:inventory.varietyBelongsToAnotherProducer", { id: oIDVty });
        aResp.render("Misc/400");
        return;
      }

      if (oFldsVty.QtyOffer && oVtyOrig.CkInvtMgd && !oCkStaff) {
        await oConn.wRollback();

        aResp.status(400);
        aResp.locals.Msg = aReq.t("common:inventory.nonStaffCannotSetManagedQuantities");
        aResp.render("Misc/400");
        return;
      }

      // The offer quantity can be changed after the delivery window, in which
      // case the next-cycle quantity is affected:
      if (oFldsVty.QtyOffer && PhaseCycLess(oStApp.CdPhaseCyc, "EndDeliv") && oInvcProducer) {
        // We could also delete the field, process any listing status changes,
        // and then display a message. This only happens if check-in was
        // completed while this page was open, however.

        await oConn.wRollback();

        const oMsg = aReq.t("common:inventory.cannotChangeQuantitiesAfterCheckIn");
        aResp.Show_Flash("danger", null, oMsg);

        aResp.redirect(303, "/producer-inventory");
        return;
      }

      const oCdsListVtyValid = CdsListVtyValid(oVtyOrig, oCkStaff);
      if (!oCdsListVtyValid[oFldsVty.CdListVty.ValCook]) {
        await oConn.wRollback();

        aResp.status(400);
        aResp.locals.Msg = aReq.t("common:inventory.invalidVarietyListingStatus", { status: oFldsVty.CdListVty.ValCook });
        aResp.render("Misc/400");
        return;
      }
    }

    // Check cart items
    // ················

    if (oFldsRoll.ItsCart) {
      for (const oIDItCart in oFldsRoll.ItsCart) {
        const oFldsItCart = oFldsRoll.ItsCart[oIDItCart];

        const oItCartOrig = await wItCartFromID(oConn, oIDItCart);
        if (!oItCartOrig) {
          await oConn.wRollback();

          aResp.status(400);
          aResp.locals.Msg = aReq.t("common:inventory.invalidCartItemId", { id: oIDItCart });
          aResp.render("Misc/400");
          return;
        }

        if (oFldsItCart.CkDenyNoteShop && oInvcProducer) {
          // We could also delete the fields, process any listing status
          // changes, and then display a message. This only happens if check-in
          // was completed while this page was displayed.

          await oConn.wRollback();

          const oMsg = aReq.t("common:inventory.cannotChangeNoteDenialAfterCheckIn");
          aResp.Show_Flash("danger", null, oMsg);

          aResp.redirect(303, "/producer-inventory");
          return;
        }
      }
    }

    // Update varieties
    // ----------------
    // We won't update the variety edit time, since only the offer quantity or
    // listing status is changing.

    /** Varieties for which promised quantities or note statuses have changed. */
    const oIDsVtyChgProm = [];

    for (const oIDVty in oFldsRoll.Vtys) {
      // CkDenyNoteShop is part of the ItsCart collection, so it is not included
      // here:
      const oFldsVty = oFldsRoll.Vtys[oIDVty];
      // Convert from CdListVty back to CkListWeb, CkListOnsite, and CkArchiv:
      const oParamsEx = CksFromCdListVty(oFldsVty.CdListVty.ValCook);
      await wUpdOne("Vty", "IDVty", oIDVty, oFldsVty, oParamsEx, oConn);

      if (PhaseCycGreater(oStApp.CdPhaseCyc, "StartDeliv")) continue;

      const oCkChgProm = await wLockBal_QtyProm(oConn, oIDVty);
      if (oCkChgProm) oIDsVtyChgProm.push(oIDVty);
    }

    // Update items
    // ------------
    // If the producer prints labels and then denies or un-denies notes, the
    // labels will become invalid as the cart ID and note are removed or added.
    // Technically, we could keep the weights in the WgtLblOrdWeb table if notes
    // are denied or un-denied, as only the NoteShop and IDItCart fields would
    // need to change, but it doesn't seem worth the trouble to implement that.
    //
    // Also, when denying or un-denying notes, we could try to clear only those
    // weights associated with the relevant cart item ID, but it would be
    // necessary then to store those IDs in WgtLblOrdWeb even when there is no
    // note. That does not seem sensible, so we will skip it. The producer
    // should not be doing this in the first place.

    const oItsCart = oFldsRoll.ItsCart || {};
    for (const oIDItCart in oItsCart) {
      const oFldsItCart = oItsCart[oIDItCart];

      const oIDVty = await wIDVtyFromIDItCart(oConn, oIDItCart);
      if (!oIDVty) throw Error("producer-inventory wHandPost: Invalid cart item ID");

      // It is safe to call wDeny_NoteShop and wUndeny_NoteShop regardless of
      // the current note status:
      if (oFldsItCart.CkDenyNoteShop.ValCook) {
        if (!(await wDeny_NoteShop(oConn, oIDItCart))) continue;

        oIDsVtyChgProm.push(oIDVty);

        let oMsg = aReq.t("common:inventory.noteCannotBeHonored");
        // Don't need to worry about phase changes here, we're just sending a
        // message:
        if (aResp.locals.FlagShop)
          oMsg += " " + aReq.t("common:inventory.pleaseRemoveItemIfUnwanted");
        // No need to await:
        wSend_MsgItCart(oIDItCart, "danger", aReq.t("common:inventory.sorry"), oMsg);
      } else {
        if (!(await wUndeny_NoteShop(oConn, oIDItCart))) continue;

        oIDsVtyChgProm.push(oIDVty);

        const oMsg = aReq.t("common:inventory.noteWillBeHonoredAfterAll");
        // No need to await:
        wSend_MsgItCart(oIDItCart, "success", aReq.t("common:inventory.goodNews"), oMsg);
      }
    }

    // Update ItDeliv and WgtLblOrdWeb
    // -------------------------------

    // These tables are not filled until EndShop, and they are not to be updated
    // after EndDeliv:
    if (PhaseBetw(oStApp.CdPhaseCyc, "EndShop", "EndDeliv"))
      for (const oIDVty of oIDsVtyChgProm) {
        await wLockUpd_ItDeliv(oConn, oIDVty);
        await wLockUpd_WgtLblOrdWeb(oConn, oIDVty);
      }

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    throw aErr;
  } finally {
    oConn.Release();
  }

  // Return to Producer Inventory page
  // ---------------------------------

  aResp.Show_Flash("success", null, aReq.t("common:inventory.inventoryUpdated"));

  // Can't decide where to go after Cancel or Save. Seems like the producer
  // might be saving their work incrementally, as they probably should do:
  aResp.redirect(303, "/producer-inventory");
}

/** Returns the specified producer's products, with category and subcategory
 *  data. */
async function wProducts(aIDProducer) {
  const oSQL = `SELECT Product.IDProduct, Product.NameProduct, Product.NameImgProduct,
			Cat.IDCat, Cat.NameCat,
			Subcat.IDSubcat, Subcat.NameSubcat
		FROM Product
		LEFT JOIN Subcat USING (IDSubcat)
		LEFT JOIN Cat USING (IDCat)
		WHERE Product.IDProducer = ?
		ORDER BY Cat.NameCat, Cat.IDCat,
			Subcat.NameSubcat, Subcat.IDSubcat,
			Product.NameProduct, Product.IDProduct`;
  const [oRows] = await Conn.wExecPrep(oSQL, [aIDProducer]);
  return oRows;
}

/** Returns the specified product's varieties. */
async function wVtys(aIDProduct) {
  const oSQL = `SELECT Vty.PriceNomWeb, Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkInvtMgd, Vty.CkListWeb, Vty.CkListOnsite, Vty.CkArchiv,
			Vty.QtyOffer, Vty.CdVtyType,
			IFNULL(zItCartVty.QtyProm, 0) AS QtyProm,
			IFNULL(zItCartVty.QtyOrd, 0) AS QtyOrd,
			IFNULL(zItCartVty.QtyWithdr, 0) AS QtyWithdr
		FROM Vty
		LEFT JOIN (
			SELECT Vty.IDVty,
				SUM(ItCart.QtyOrd) AS QtyOrd, SUM(ItCart.QtyProm) AS QtyProm,
				SUM(ItCart.QtyWithdr) AS QtyWithdr
			FROM Vty
			JOIN ItCart USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY Vty.IDVty
		) AS zItCartVty ON (zItCartVty.IDVty = Vty.IDVty)
		WHERE Vty.IDProduct = :IDProduct
		AND Vty.CdVtyType = 'Retail'
		ORDER BY Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDProduct: aIDProduct,
  };
  const [oVtys] = await Conn.wExecPrep(oSQL, oParams);

  // Add CdListVty, which will stand in for CkListWeb, CkListOnsite, and
  // CkArchiv:
  for (const oVty of oVtys) oVty.CdListVty = CdListVtyFromCks(oVty);

  return oVtys;
}

/** Returns notes associated with the specified variety. */
async function wNotesShopActiv(aIDVty) {
  const oSQL = `SELECT ItCart.IDItCart, ItCart.QtyProm, ItCart.NoteShop,
			ItCart.NoteShopDenied,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Email1
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
		JOIN Memb USING (IDMemb)
		WHERE ItCart.IDVty = :IDVty
			AND (
				(ItCart.NoteShop IS NOT NULL)
				OR (ItCart.NoteShopDenied IS NOT NULL)
			)
		ORDER BY Memb.Name1First, Memb.Name1Last, Memb.IDMemb`;
  const oParams = {
    IDVty: aIDVty,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

async function wItCartFromID(aConn, aIDItCart) {
  const oSQL = `SELECT *
		FROM ItCart
		WHERE IDItCart = ?`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDItCart]);
  return oRows.length ? oRows[0].IDVty : null;
}

/** Update-locks the specified producer's products and varieties, along with any
 *  associated cart items. */
async function wLock_ProductsVtysItsCart(aConn, aIDProducer) {
  const oSQL = `SELECT *
		FROM Vty
		JOIN ItCart USING (IDVty)
		JOIN Product USING (IDProduct)
		WHERE Product.IDProducer = :IDProducer
		FOR UPDATE`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  const [_oRows] = await aConn.wExecPrep(oSQL, oParams);
}

async function wIDVtyFromIDItCart(aConn, aIDItCart) {
  const oSQL = `SELECT ItCart.IDVty
		FROM ItCart
		WHERE ItCart.IDItCart = ?`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDItCart]);
  return oRows.length ? oRows[0].IDVty : null;
}

/** Denies the shopper note in the specified cart item record if that record
 *  contains a note. Does nothing if there is no note, or if it has already been
 *  denied. Returns 'true' if the record was modified. */
async function wDeny_NoteShop(aConn, aIDItCart) {
  // At present, if the shopper changes the note while this page is open, this
  // function will cause the new note to be denied. It would be better to add
  // the note in the page to this WHERE, so that changed notes are unaffected. A
  // warning could also be sent to the producer, but that may not be necessary,
  // since shoppers are allowed to bypass note denials at any time by changing
  // notes. [TO DO]
  //
  // In like manner, if the shopper changes a denied note while this page is
  // open, the new note will be un-denied, but that is always true when notes
  // are edited.

  const oSQL = `UPDATE ItCart
		SET NoteShopDenied = NoteShop, NoteShop = NULL
		WHERE (IDItCart = ?) AND (NoteShop IS NOT NULL)`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDItCart]);
  return oRows.changedRows > 0;
}

/** Restores the shopper note in the specified cart item record if that record
 *  contains a denied note. Does nothing if there is no denied note. Returns
 *  'true' if the record was modified. */
async function wUndeny_NoteShop(aConn, aIDItCart) {
  const oSQL = `UPDATE ItCart
		SET NoteShop = NoteShopDenied, NoteShopDenied = NULL
		WHERE IDItCart = ? AND NoteShopDenied IS NOT NULL`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDItCart]);
  return oRows.changedRows > 0;
}
