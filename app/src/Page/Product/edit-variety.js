// edit-variety.js
// ---------------
// Edit Variety controllers

import { wLockBal_QtyProm, wLockUpd_ItDeliv, wLockUpd_WgtLblOrdWeb } from "../../Invt.js";
import {
  Valid as _Valid,
  wExec,
  Valid_FldsVtyPriceVar,
  CkFail,
  Retry,
  wUpdOne,
} from "../../Form.js";
import {
  wInvcProducerWeb,
  wConnNew,
  wLock_StApp,
  wLock_InvcProducerWeb,
  PhaseCycLess,
  PhaseBetw,
  Conn,
  wProducerFromIDProduct,
} from "../../Db.js";
import { Add_Props, PageAfterEditProduct } from "../../Util.js";
import { CoopParams } from "../../Site.js";

/** Returns an object containing fields that should be disabled in the form, and
 *  ignored during form processing. */
function FldsDisab(aReq, aResp, aVty, aCkCheckIn, aIsWholesaleProducer, aIsWholesaleVarietyType) {
  const oCkStaff = aReq.user.CkStaff();
  const oFlds = {};

  if (!aIsWholesaleVarietyType && aVty.CkListOnsite && !oCkStaff)
    oFlds.CkArchiv = { Msg: "Listed varieties cannot be archived." };

  // The managed inventory flag affects shopper notes, producer label printing,
  // and producer inventory fees. CkInvtMgd is always disabled when editing, but
  // not when adding:
  oFlds.CkInvtMgd = {
    Msg: "After the variety is created, this flag cannot be changed until the " + "next cycle.",
  };

  oFlds.CkPriceVar = {};

  if (aResp.PhaseCycGreaterEq("EndShop"))
    oFlds.PriceNomWeb = {
      Msg: "You cannot change the current web price after the shopping window " + "has closed.",
    };
  if (aResp.PhaseCycEq("StartDeliv") || aResp.PhaseCycEq("EndDeliv")) {
    oFlds.QtyOffer = {
      Msg: "You cannot change the current web inventory during the delivery cycle",
    };
  }

  if (aResp.locals.FlagDeliv && aCkCheckIn)
    oFlds.QtyOffer = {
      Msg:
        "You cannot change the current-cycle offer quantity after " +
        "checking-in. You will be able to change the next-cycle quantity " +
        "when the delivery window closes.",
    };

  if (!oCkStaff) {
    oFlds.CkInvtMgdNext = { Msg: "Only staff can change this setting." };
    if (aIsWholesaleProducer) {
      if (!aIsWholesaleVarietyType) {
        const oData = { Msg: "Can be changed only for wholesale varieties." };
        oFlds.CkListOnsite = oData;
        oFlds.QtyOnsite = oData;
        oFlds.PriceNomOnsite = oData;
      }
    } else {
      const oData = {
        Msg: "Only staff or wholesale producer can change this setting.",
      };
      oFlds.CkListOnsite = oData;
      oFlds.QtyOnsite = oData;
      oFlds.PriceNomOnsite = oData;
    }
  }

  if (aVty.CkInvtMgd && !oCkStaff) {
    oFlds.CkListWeb = {
      Msg: `This inventory is managed. Only ${CoopParams.CoopNameShort} can change the listing status.`,
    };
    oFlds.CkArchiv = {
      Msg: `This inventory is managed. Only ${CoopParams.CoopNameShort} can change the archive status.`,
    };
    oFlds.QtyOffer = {
      Msg: `This inventory is managed. Only ${CoopParams.CoopNameShort} can change the offer quantity.`,
    };
    oFlds.PriceNomWeb = {
      Msg: `This inventory is managed. Only ${CoopParams.CoopNameShort} can change the price.`,
    };
    oFlds.PriceNomWebNext = oFlds.PriceNomWeb;
  }

  return oFlds;
}

export async function wHandGet(aReq, aResp) {
  // This handler is also invoked after validation failures, so conserve the
  // user's previous input, if any:
  Add_Props(aResp.locals, aResp.locals.VtySel);

  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  const oCkCheckIn = !!(await wInvcProducerWeb(oIDProducer));
  const oIDProduct = aResp.locals.VtySel.IDProduct;
  const oIsWholesaleVarietyType = aResp.locals.VtySel.CdVtyType === "Wholesale";
  const oIsWholesaleProducer = await wIsWholesaleProducer(oIDProduct);
  aResp.locals.IsWholesaleProducer = oIsWholesaleProducer;
  aResp.locals.FldsDisab = FldsDisab(
    aReq,
    aResp,
    aResp.locals.VtySel,
    oCkCheckIn,
    oIsWholesaleProducer,
    oIsWholesaleVarietyType,
  );

  aResp.locals.Title = `${CoopParams.CoopNameShort} edit variety`;
  aResp.render("Product/edit-variety");
}

export async function wHandPost(aReq, aResp) {
  const oIDVty = aResp.locals.VtySel.IDVty;
  const oVtyOrig = aResp.locals.VtySel;
  if (!oVtyOrig) throw Error("edit-variety wHandPost: Cannot get original variety");
  const oIDProduct = aResp.locals.VtySel.IDProduct;
  const oIsWholesaleVarietyType = aResp.locals.VtySel.CdVtyType === "Wholesale";
  const oIsWholesaleProducer = await wIsWholesaleProducer(oIDProduct);

  // Field-level validation
  // ----------------------

  async function owValid_PriceNomWeb(aFld) {
    _Valid.Gen.Price(aFld);
    if (aFld.MsgFail) return;

    const oPriceOrig = await wPriceNomWeb(oIDVty);
    if (!oPriceOrig) return;

    if (aResp.locals.FlagShop) {
      if (aFld.ValCook > oPriceOrig)
        aFld.MsgFail =
          "You can lower prices during the shopping window, but " + "you cannot increase them.";
    } else if (aResp.PhaseCycGreaterEq("EndShop")) {
      if (aFld.ValCook !== oPriceOrig)
        aFld.MsgFail =
          "You cannot change the current price after the shopping " + "window has closed.";
    }
  }

  const oFlds = {
    CkListWeb: {},
    CkArchiv: {},
    Kind: { Valid: false },
    CkPriceVar: { CkRequire: true, Store: false },
    QtyOffer: { CkRequire: true },
    PriceNomWeb: { Valid: owValid_PriceNomWeb, CkRequire: true },
    PriceNomWebNext: { CkRequire: true },
    Upc: {},
  };

  if (oVtyOrig.CkPriceVar) {
    oFlds.WgtMin = {};
    oFlds.WgtMax = {};
  } else oFlds.Size = { Valid: false };

  const oCkStaff = aReq.user.CkStaff();
  if (oCkStaff) {
    // CkInvtMgd cannot be changed when editing.
    oFlds.CkInvtMgdNext = { CkRequire: true };
  }

  if (oCkStaff || (oIsWholesaleProducer && oIsWholesaleVarietyType)) {
    oFlds.CkListOnsite = {};
    oFlds.QtyOnsite = { CkRequire: true };
    oFlds.PriceNomOnsite = { CkRequire: true };
  }

  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  const oCkCheckIn = !!(await wInvcProducerWeb(oIDProducer));
  const oFldsDisab = FldsDisab(
    aReq,
    aResp,
    aResp.locals.VtySel,
    oCkCheckIn,
    oIsWholesaleProducer,
    oIsWholesaleVarietyType,
  );
  await wExec(aReq.body, oFlds, oFldsDisab);

  // Form-level validation
  // ---------------------

  let oCkList = oFlds.CkListWeb.ValCook;
  if (oCkStaff) oCkList |= oFlds.CkListOnsite.ValCook;

  if (oCkList && oFlds.CkArchiv.ValCook) {
    aResp.status(400);
    aResp.locals.Msg = "Invalid listing/archive combination.";
    aResp.render("Misc/400");
    return;
  }

  // This nulls the Size field, or the WgtMin and WgtMax fields, depending on
  // whether CkPriceVar is set. The form merely hides the unwanted fields, so
  // they may or may not have values:
  Valid_FldsVtyPriceVar(oFlds, oVtyOrig.CkPriceVar);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Update variety record
  // ---------------------
  // So using this page to set the offer quantity or the listing status will
  // cause the edit time to be updated? Maybe it should always be updated with a
  // trigger, which can compare the old and new values for certain fields only?
  // [TO DO]

  const oParamsEx = {
    WhenEdit: new Date(),
  };

  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    const oStApp = await wLock_StApp(oConn);

    const oIDProducer = aResp.locals.CredImperUser.IDProducer;
    const oInvcProducer = await wLock_InvcProducerWeb(oConn, oIDProducer);
    // QtyOffer should have been disabled in this handler by FldsDisab, but that
    // doesn't mean it was disabled when the form was displayed by the GET
    // handler.
    //
    // If we moved FldsDisab inside the transaction, we could count on it to
    // prevent QtyOffer from being updated, but the user would not know that
    // their input had been ignored, and we would still have to avoid
    // wBal_QtyProm and other second-order changes:
    if (
      aReq.body.QtyOffer !== undefined &&
      PhaseCycLess(oStApp.CdPhaseCyc, "EndDeliv") &&
      oInvcProducer
    ) {
      // We could also delete the field, process any other changes, and then
      // display a message. This only happens if check-in was completed while
      // this page was open, however.

      await oConn.wRollback();

      const oMsg =
        "You cannot change quantities during the delivery window " +
        "after you have checked-in. You can update your next-cycle " +
        "quantities when the delivery window closes.";
      aResp.Show_Flash("danger", null, oMsg);

      // Might be nice to conserve the user's input with:
      //
      //   gForm.Retry(aResp, oFlds);
      //   exports.wHandGet(aReq, aResp);
      //
      // but that would require extra testing. This shouldn't happen often:
      const oPage = "/edit-variety/" + oIDVty;
      aResp.redirect(303, oPage);
      return;
    }

    await wLock_ProductVtyItsCart(oConn, oIDVty);

    await wUpdOne("Vty", "IDVty", oIDVty, oFlds, oParamsEx, oConn);

    let oCkChgProm = false;
    // We checked for a producer invoice above:
    if (PhaseCycLess(oStApp.CdPhaseCyc, "EndDeliv"))
      oCkChgProm = await wLockBal_QtyProm(oConn, oIDVty);

    // These tables are not filled until EndShop, and they are not to be updated
    // after EndDeliv:
    if (oCkChgProm && PhaseBetw(oStApp.CdPhaseCyc, "EndShop", "EndDeliv")) {
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

  // Return or go to Product Detail
  // ------------------------------

  aResp.Show_Flash("success", null, aReq.t("common:variety.varietyUpdated"));

  const oPage = PageAfterEditProduct(aReq, aResp);
  aResp.redirect(303, oPage);
}

async function wPriceNomWeb(aIDVty) {
  const oSQL = `SELECT PriceNomWeb
		FROM Vty
		WHERE IDVty = :IDVty`;
  const oParams = {
    IDVty: aIDVty,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0].PriceNomWeb : null;
}

/** Update-locks the specified variety and its product, along with any
 *  associated cart items. */
async function wLock_ProductVtyItsCart(aConn, aIDVty) {
  const oSQL = `SELECT *
		FROM Vty
		JOIN ItCart USING (IDVty)
		JOIN Product USING (IDProduct)
		WHERE Vty.IDVty = :IDVty
		FOR UPDATE`;
  const oParams = {
    IDVty: aIDVty,
  };
  const [_oRows] = await aConn.wExecPrep(oSQL, oParams);
}

// The Producer should be fetched by the Product ID, because the user on the response can be
// a staff member
const wIsWholesaleProducer = async aIDProduct => {
  if (!aIDProduct) {
    console.error("wIsWholesaleProducer_error: No product ID");
    return false;
  }
  const oProducer = await wProducerFromIDProduct(aIDProduct);
  if (!oProducer) {
    console.error("wIsWholesaleProducer_error: Could not find producer record");
    return false;
  }
  return oProducer.CdRegWholesale === "Approv";
};
