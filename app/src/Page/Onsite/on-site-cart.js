// on-site-cart.js
// ---------------
// On-site Cart page controllers

import { Unroll, wExec, Roll, CkFail, Retry } from "../../Form.js";
import {
  wCartOnsitePendOrCreate,
  wDel_CartOnsitePend,
  Conn,
  wConnNew,
  wDel_ItsCartOnsitePend,
  wAdd_ItCartOnsitePend,
  wCartOnsitePend,
} from "../../Db.js";
import { Add_Props } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // This will be set already if there was a validation failure:
  const oIDSess = aReq.session.id;
  if (aResp.locals.Vtys === undefined) {
    aResp.locals.Vtys = await wVtys(oIDSess);
  }
  const oCdCartType = await wGetCartType(oIDSess);

  aResp.locals.Title =
    oCdCartType === "Wholesale"
      ? aReq.t("common:pageTitles.onSiteCartWholesale", { name: CoopParams.CoopNameShort })
      : aReq.t("common:pageTitles.onSiteCart", { name: CoopParams.CoopNameShort });
  aResp.locals.CdCartType = !!oCdCartType ? oCdCartType : "";
  aResp.locals.AllVtys = await getAllVtys();

  aResp.render("Onsite/on-site-cart");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------
  // The view suffixes weight input names with the variety ID and the input
  // index (separated by a dash) so that multiple varieties can be submitted,
  // each with multiple weights.

  const oFlds = {
    // Normally, we would not accept blank entries for quantities, but in this
    // case, we want to allow zero quantities. The form system automatically
    // converts blanks number entries to zeroes, so I guess blanks are
    // acceptable:
    Qty: { Collect: "Its" },
    WgtPer: { Collect: "Its" },
  };

  const oFldsUnroll = Unroll(aReq.body, oFlds);
  await wExec(aReq.body, oFldsUnroll);
  const oFldsRoll = Roll(oFldsUnroll);

  // Extract quantities and weights
  // ------------------------------

  /** QtyRaw and QtyCook values, or WgtsRaw and WgtsCook arrays, by variety ID. */
  const oItsByIDVty = {};
  /** Context-level validation failure messages, to be used for weight inputs,
   *  which are too numerous to have their own message divs. */
  const oMsgsFail = {};

  for (const oIDs in oFldsRoll.Its) {
    // The variety ID and weight index pattern, found at the end of the field
    // name:
    const oPattIDVtyIdx = /([\d]+)-([\d]+)/;
    const oMatches = oPattIDVtyIdx.exec(oIDs);
    const oCkIdx = oMatches && oMatches.length === 3;
    const oIDVty = oCkIdx ? oMatches[1] : oIDs;

    let oDataVty = oItsByIDVty[oIDVty];
    if (oDataVty === undefined) {
      oDataVty = {};
      oItsByIDVty[oIDVty] = oDataVty;
    }

    const oFld = oFldsRoll.Its[oIDs];
    if (oFld.Qty !== undefined) {
      oDataVty.QtyRaw = oFld.Qty.ValRaw;
      if (oFld.Qty.ValCook !== null) oDataVty.QtyCook = oFld.Qty.ValCook;
    } else if (oFld.WgtPer !== undefined) {
      if (oDataVty.WgtsRaw === undefined) {
        oDataVty.WgtsRaw = [];
        oDataVty.WgtsCook = [];
      }

      oDataVty.WgtsRaw.push(oFld.WgtPer.ValRaw);
      // Empty inputs will have 'null' cooked values:
      if (oFld.WgtPer.ValCook !== null) oDataVty.WgtsCook.push(oFld.WgtPer.ValCook);

      if (oFld.WgtPer.MsgFail) oMsgsFail["MsgFailWgts" + oIDVty] = oFld.WgtPer.MsgFail;
    }
  }

  // Handle validation failure
  // -------------------------
  // It might be nice to reject weight values that are well outside the
  // expected range, but I don't think that is MVP.

  if (CkFail(oFldsUnroll)) {
    Retry(aResp, oFldsUnroll);

    aResp.locals.Vtys = await wVtysFromRaw(oItsByIDVty);
    Add_Props(aResp.locals, oMsgsFail);

    wHandGet(aReq, aResp);
    return;
  }

  // Update or delete pending cart tables
  // --------------------------
  // In most cases, we send POST input directly to the code that uses it. In
  // this case, we must save any changes before presenting the checkout page;
  // otherwise, if the checkout were canceled for some reason, the most recent
  // changes would be lost.

  const oIDSess = aReq.session.id;
  await wCartOnsitePendOrCreate(oIDSess, aReq.user.IDMemb);

  await wUpd_ItsCart(oIDSess, oItsByIDVty);

  // We can't checkout if the cart is empty. The Empty Cart button causes the
  // Save button to be hidden, but this can also be accomplished by clearing all
  // the quantities and weights before saving.
  // Delete the cart if it is empty
  // We need to fetch the cart again after the update
  const oUpdatedVtys = await wVtys(oIDSess);
  if (oUpdatedVtys.length === 0) {
    await wDel_CartOnsitePend(oIDSess);
    aResp.redirect(303, "/on-site-cart");
    return;
  } else {
    aResp.redirect(303, "/on-site-checkout");
    return;
  }
}

export async function wVty(aIDVty, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.Upc,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct,
			Producer.IDProducer, Producer.NameBus
		FROM Vty
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE Vty.IDVty = :IDVty
		ORDER BY Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oData = {
    IDVty: aIDVty,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oData);
  if (oRows.length !== 1) throw Error("on-site-cart wVty: Cannot get variety data");
  return oRows[0];
}

async function wVtysFromRaw(aItsByIDVty) {
  const oVtys = [];
  for (const oIDVty in aItsByIDVty) {
    const oIt = aItsByIDVty[oIDVty];

    const oVty = await wVty(oIDVty);
    if (oIt.WgtsRaw) {
      oVty.WgtsFulf = oIt.WgtsRaw;
      // For consistency with the original query:
      oVty.Qty = oIt.WgtsRaw.length;
    } else oVty.Qty = oIt.QtyRaw;

    oVtys.push(oVty);
  }
  return oVtys;
}

async function wUpd_ItsCart(aIDSess, aItsByIDVty) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    await wDel_ItsCartOnsitePend(aIDSess, oConn);

    for (const oIDVty in aItsByIDVty) {
      const oIt = aItsByIDVty[oIDVty];
      if (!oIt.QtyCook && !oIt.WgtsCook) continue;

      const oVty = await wVty(oIDVty, oConn);
      if (oVty.CkPriceVar) {
        if (oIt.WgtsCook)
          for (const oWgt of oIt.WgtsCook)
            await wAdd_ItCartOnsitePend(aIDSess, oIDVty, oWgt, 1, oConn);
      }
      // Recall that MySQL prevents us from making this WgtPer field
      // nullable, so we use zero to indicate no weight:
      else await wAdd_ItCartOnsitePend(aIDSess, oIDVty, 0, oIt.QtyCook, oConn);
    }

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    throw aErr;
  } finally {
    oConn.Release();
  }
}

async function _wDel_ItsCart(aIDSess) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    await wDel_ItsCartOnsitePend(aIDSess, oConn);
    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    throw aErr;
  } finally {
    oConn.Release();
  }
}

/** Returns all variety records in the pending on-site cart, with WgtsFulf
 *  arrays in the records representing variable-price items. */
async function wVtys(aIDSess) {
  const oSQL = `SELECT ItCartOnsitePend.WgtPer, ItCartOnsitePend.Qty,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.PriceNomOnsite, Vty.Upc,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct,
			Producer.IDProducer, Producer.NameBus
		FROM ItCartOnsitePend
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE IDSess = :IDSess
		ORDER BY Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty,
			ItCartOnsitePend.WgtPer`;
  const oData = {
    IDSess: aIDSess,
  };
  const [oIts] = await Conn.wExecPrep(oSQL, oData);

  // Structure by variety
  // --------------------
  // Add weight arrays to variable-price variety records. All records have
  // quantity fields.

  const oVtys = [];

  let oVtyLast;
  for (const oIt of oIts) {
    if (!oVtyLast || oIt.IDVty != oVtyLast.IDVty) {
      oVtyLast = {
        IDVty: oIt.IDVty,
        Kind: oIt.Kind,
        Size: oIt.Size,
        WgtMin: oIt.WgtMin,
        WgtMax: oIt.WgtMax,
        PriceNomOnsite: oIt.PriceNomOnsite,
        CkPriceVar: oIt.CkPriceVar,
        IDProduct: oIt.IDProduct,
        NameProduct: oIt.NameProduct,
        IDProducer: oIt.IDProducer,
        NameBus: oIt.NameBus,
        Qty: oIt.Qty,
      };
      if (oIt.CkPriceVar) oVtyLast.WgtsFulf = [];

      oVtys.push(oVtyLast);
    }

    if (oIt.CkPriceVar) {
      // The first quantity was added when oVtyLast was set:
      if (oVtyLast.WgtsFulf.length) oVtyLast.Qty += oIt.Qty;

      // Unlike ItDeliv or ItPickup, weighted items can have non-unit
      // quantities, so it is necessary to repeat them:
      for (let o = 0; o < oIt.Qty; ++o) oVtyLast.WgtsFulf.push(oIt.WgtPer);
    }
  }

  return oVtys;
}

async function wGetCartType(aIDSess) {
  const cart = await wCartOnsitePend(aIDSess);
  return cart ? cart.CdCartType : null;
}

export async function getVtyFromUpc(upc) {
  const oSQL = `SELECT Vty.IDVty
			FROM Vty
			WHERE Vty.Upc = ${upc}`;
  const oData = {};
  const [oRows] = await Conn.wExecPrep(oSQL, oData);
  return oRows[0].IDVty;
}

export async function getAllVtys(_upc) {
  const oSQL = `SELECT Vty.IDVty, Vty.Upc
		FROM Vty`;
  const oData = {};
  const [oRows] = await Conn.wExecPrep(oSQL, oData);
  return oRows;
}
