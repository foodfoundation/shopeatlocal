// edit-web-order-label-weights.js
// -------------------------------
// Edit Web Order Label Weights page controllers

import { Unroll, wExec, Roll, CkFail, Retry, wUpd } from "../../Form.js";
import { wConnNew, wLock_StApp, PhaseCycLess, Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // Check shopping window end
  // -------------------------

  if (aResp.PhaseCycLess("EndShop")) {
    aResp.Show_Flash(
      "danger",
      null,
      aReq.t("common:webOrderLabelWeights.cannotEnterWeightsShoppingNotClosed"),
    );

    aResp.redirect(303, "/web-order-labels");
    return;
  }

  // I was disallowing weight entry after producer check-in, but why bother,
  // especially when producers can check-in more than once?

  // Render page
  // -----------

  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  aResp.locals.Vtys = await wVtys(oIDProducer);

  aResp.locals.Title = aReq.t("common:pageTitles.editWebOrderLabelWeights", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("Producer/edit-web-order-label-weights");
}

export async function wHandPost(aReq, aResp) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // Check shopping window end
    // -------------------------

    const oStApp = await wLock_StApp(oConn);
    if (PhaseCycLess(oStApp.CdPhaseCyc, "EndShop")) {
      await oConn.wRollback();

      aResp.status(403);
      aResp.render("Misc/403");
      return;
    }

    // I was disallowing weight entry after producer check-in, but why bother,
    // especially when producers can check-in more than once?

    // Field-level validation
    // ----------------------

    const oFlds = {
      // I guess there's no reason to require that all labels be entered
      // together, so we won't set CkRequire:
      WgtPer: { Collect: "WgtsLbl" },
    };

    const oFldsUnroll = Unroll(aReq.body, oFlds);
    await wExec(aReq.body, oFldsUnroll);
    const oFldsRoll = Roll(oFldsUnroll);

    // If no products or varieties appear in the page, this array won't even be
    // defined:
    if (!oFldsRoll.WgtsLbl) {
      await oConn.wRollback();

      aResp.status(400);
      aResp.locals.Msg = aReq.t("common:webOrderLabelWeights.noWeightsToStore");
      aResp.render("Misc/400");
      return;
    }

    // Check label ownership
    // ---------------------

    const oIDProducer = aResp.locals.CredImperUser.IDProducer;

    const oIDsWgtLbl = Object.keys(oFldsRoll.WgtsLbl);
    const oProducersWgtLbl = await wProducersByIDsWgtLbl(oIDsWgtLbl, oConn);
    if (oProducersWgtLbl.length != 1 || oProducersWgtLbl[0].IDProducer !== oIDProducer) {
      await oConn.wRollback();

      aResp.status(400);
      aResp.locals.Msg = aReq.t("common:webOrderLabelWeights.itemsBelongToAnotherProducer");
      aResp.render("Misc/400");
      return;
    }

    // Handle validation failure
    // -------------------------
    // It might be nice to reject weight values that are well outside the
    // expected range, but I don't think that is MVP.

    if (CkFail(oFldsUnroll)) {
      await oConn.wRollback();

      Retry(aResp, oFldsUnroll);

      const oVtys = await wVtys(oIDProducer, oConn);
      for (const oVty of oVtys)
        for (const oElNote of oVty.ElsNote)
          for (const oWgt of oElNote.WgtsLbl)
            oWgt.WgtPer = oFldsRoll.WgtsLbl[oWgt.IDWgtLblOrdWeb].WgtPer.ValRaw;
      aResp.locals.Vtys = oVtys;

      aResp.locals.Title = aReq.t("common:pageTitles.editWebOrderLabelWeights", {
        name: CoopParams.CoopNameShort,
      });
      aResp.render("Producer/edit-web-order-label-weights");
      return;
    }

    // Update weights
    // --------------
    // WgtLblOrdWeb is keyed with auto-increment field IDWgtLblOrdWeb. That
    // table is always updated by deleting old records and then re-inserting,
    // so, if an update happens while the Edit Web Order Label Weights form is
    // displayed, the IDWgtLblOrdWeb values in the form will reference deleted
    // records. wUpd will return zero, and the transaction can be rolled-back.

    for (const oIDWgtLbl in oFldsRoll.WgtsLbl) {
      const oFldsWgtLbl = oFldsRoll.WgtsLbl[oIDWgtLbl];
      const oCtUpd = await wUpd(
        "WgtLblOrdWeb",
        "IDWgtLblOrdWeb",
        oIDWgtLbl,
        oFldsWgtLbl,
        {},
        oConn,
      );

      if (!oCtUpd) {
        await oConn.wRollback();

        aResp.Show_Flash(
          "danger",
          null,
          aReq.t("common:webOrderLabelWeights.inventoryUpdatedDuringEdit"),
        );

        aResp.redirect(303, "/edit-web-order-label-weights");
        return;
      }
    }

    // Return to Web Order Labels page
    // -------------------------------

    aResp.Show_Flash("success", null, aReq.t("common:webOrderLabelWeights.weightsUpdated"));

    aResp.redirect(303, "/web-order-labels");

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    // So that the pipline exception handler sends the usual 500 response:
    throw aErr;
  } finally {
    oConn.Release();
  }
}

/** Returns one record for each variety/note combination, with each of these
//  containing a WgtsLbl array containing weight data for that record. */
async function wVtys(aIDProducer, aConn) {
  if (!aConn) aConn = Conn;

  // Get product, variety, and weight data
  // -------------------------------------

  const oSQL = `SELECT WgtLblOrdWeb.*,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Product.IDProduct, Product.NameProduct,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Email1
		FROM WgtLblOrdWeb
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		LEFT JOIN ItCart USING (IDItCart)
		LEFT JOIN Cart USING (IDCart)
		LEFT JOIN Memb USING (IDMemb)
		WHERE IDProducer = ?
		ORDER BY Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty,
			WgtLblOrdWeb.NoteShop, Cart.IDMemb`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDProducer]);

  // Structure weight records by variety and note
  // --------------------------------------------

  const oVtys = [];
  let oVtyLast = undefined;
  let oElNoteLast = undefined;
  for (const oRow of oRows) {
    // Add variety:
    if (!oVtyLast || oRow.IDVty !== oVtyLast.IDVty) {
      oVtyLast = {
        IDProduct: oRow.IDProduct,
        NameProduct: oRow.NameProduct,
        IDVty: oRow.IDVty,
        Kind: oRow.Kind,
        Size: oRow.Size,
        WgtMin: oRow.WgtMin,
        WgtMax: oRow.WgtMax,
        ElsNote: [],
      };
      oVtys.push(oVtyLast);
      oElNoteLast = undefined;
    }

    // Add note element:
    if (
      !oElNoteLast ||
      oRow.NoteShop !== oElNoteLast.NoteShop ||
      oRow.IDMemb !== oElNoteLast.IDMemb
    ) {
      oElNoteLast = {
        NoteShop: oRow.NoteShop,
        IDMemb: oRow.IDMemb,
        Name1First: oRow.Name1First,
        Name1Last: oRow.Name1Last,
        Email1: oRow.Email1,
        WgtsLbl: [],
      };
      oVtyLast.ElsNote.push(oElNoteLast);
    }

    // Add label weight:
    const oWgtLbl = {
      IDWgtLblOrdWeb: oRow.IDWgtLblOrdWeb,
      WgtPer: oRow.WgtPer,
    };
    oElNoteLast.WgtsLbl.push(oWgtLbl);
  }
  return oVtys;
}

/** Returns all producer IDs associated with the specified web order label
 *  weight IDs. */
async function wProducersByIDsWgtLbl(aIDsWgtLbl, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT DISTINCT Producer.IDProducer
		FROM WgtLblOrdWeb
		LEFT JOIN Vty USING (IDVty)
		LEFT JOIN Product USING (IDProduct)
		LEFT JOIN Producer USING (IDProducer)
		WHERE WgtLblOrdWeb.IDWgtLblOrdWeb IN (?)`;
  const [oRows] = await aConn.wExecPrep(oSQL, aIDsWgtLbl);
  return oRows;
}
