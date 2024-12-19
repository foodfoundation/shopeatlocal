// add-variety.js
// --------------
// Add Variety controllers

import {
  wExec,
  Upd_FldsVtyPriceVar,
  Valid_FldsVtyPriceVar,
  CkFail,
  Retry,
  wIns,
} from "../../Form.js";
import { wProducerFromIDProduct } from "../../Db.js";
import { PageAfterEditProduct } from "../../Util.js";
import { CoopParams } from "../../Site.js";

/**
 * Returns an object containing fields that should ignored during form processing.
 */
function wFldsDisabledPost(aReq, aIsWholesaleProducer, aIsWholesaleVarietyType) {
  const oCkStaff = aReq.user.CkStaff();
  const oFlds = {};

  if (!oCkStaff) {
    const oData = {
      Msg: `Only ${CoopParams.CoopNameShort} staff can change this setting.`,
    };
    oFlds.CkInvtMgd = oData;
    oFlds.CkInvtMgdNext = oData;
  }

  if (aIsWholesaleVarietyType) {
    if (!aIsWholesaleProducer) {
      const oData = {
        Msg: "Only wholesale producers can change this setting.",
      };
      oFlds.CkListOnsite = oData;
      oFlds.QtyOnsite = oData;
      oFlds.PriceNomOnsite = oData;
    }
  } else {
    if (!oCkStaff) {
      const oData = {
        Msg: `Only ${CoopParams.CoopNameShort} staff can change this setting.`,
      };
      oFlds.CkListOnsite = oData;
      oFlds.QtyOnsite = oData;
      oFlds.PriceNomOnsite = oData;
    }
  }
  return oFlds;
}

/**
 * Returns an object containing fields that should be disabled in the form, and
 */
function FldsDisabledGet(aReq, aIsWholesaleProducer) {
  const oCkStaff = aReq.user.CkStaff();
  const oFlds = {};

  if (!oCkStaff) {
    const oData = { Msg: "Only staff can change this setting." };
    oFlds.CkInvtMgd = oData;
    oFlds.CkInvtMgdNext = oData;
  }

  if (!aIsWholesaleProducer && !oCkStaff) {
    const oData = {
      Msg: "Only staff or wholesale producer can change this setting.",
    };
    oFlds.CkListOnsite = oData;
    oFlds.QtyOnsite = oData;
    oFlds.PriceNomOnsite = oData;
  }

  return oFlds;
}

export async function wHandGet(aReq, aResp) {
  const oIDProduct = aResp.locals.ProductSel.IDProduct;
  const oIsWholesaleProducer = await wIsWholesaleProducer(oIDProduct);
  aResp.locals.IDProduct = oIDProduct;
  aResp.locals.NameProduct = aResp.locals.ProductSel.NameProduct;
  aResp.locals.IsWholesaleProducer = oIsWholesaleProducer;

  aResp.locals.FldsDisab = FldsDisabledGet(aReq, oIsWholesaleProducer);

  aResp.locals.Title = `${CoopParams.CoopNameShort} add variety`;
  aResp.render("Product/add-variety");
}

export async function wHandPost(aReq, aResp) {
  const oIdProduct = aResp.locals.ProductSel.IDProduct;
  const oIsWholesaleVarietyType = aReq.body.CdVtyType === "Wholesale";
  const oIsWholesaleProducer = await wIsWholesaleProducer(oIdProduct);

  // Field-level validation
  // ----------------------
  // We cannot conditionally add Size or WgtMin and WgtMax because we do not
  // know yet whether the variety is variably-priced. Instead, properties will
  // be deleted by gForm.Upd_FldsVtyPriceVar, below.

  const oFlds = {
    CkListWeb: {},
    CkArchiv: {},
    Kind: { Valid: false },
    CkPriceVar: { CkRequire: true, Store: false },
    Size: { Valid: false },
    WgtMin: {},
    WgtMax: {},
    QtyOffer: { CkRequire: true },
    PriceNomWeb: { CkRequire: true },
    PriceNomWebNext: { CkRequire: true },
    Upc: {},
  };

  const oCkStaff = aReq.user.CkStaff();
  if (oCkStaff) {
    oFlds.CkInvtMgd = { CkRequire: true };
    oFlds.CkInvtMgdNext = { CkRequire: true };
  }

  if (oIsWholesaleProducer) {
    oFlds.CdVtyType = { CkRequire: true };
  }

  if (oCkStaff || (oIsWholesaleProducer && oIsWholesaleVarietyType)) {
    oFlds.CkListOnsite = {};
    oFlds.QtyOnsite = { CkRequire: true };
    oFlds.PriceNomOnsite = { CkRequire: true };
  }

  const oFldsDisab = wFldsDisabledPost(aReq, oIsWholesaleProducer, oIsWholesaleVarietyType);
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

  Upd_FldsVtyPriceVar(oFlds, oFlds.CkPriceVar.ValCook);
  Valid_FldsVtyPriceVar(oFlds, oFlds.CkPriceVar.ValCook);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Create variety record
  // ---------------------

  const oParamsEx = {
    IDProduct: oIdProduct,
  };

  // The default on-site quantity is zero. There is no sensible default for the
  // price, however:
  if (!oCkStaff && !(oIsWholesaleProducer && oIsWholesaleVarietyType))
    oParamsEx.PriceNomOnsite = oFlds.PriceNomWeb.ValCook;

  const oIDVty = await wIns("Vty", oFlds, oParamsEx);
  if (!oIDVty) throw Error("wHandPost: Could not create variety record");

  // Returns to previous page
  // ------------------------

  aResp.Show_Flash("success", "Success!", "The variety has been added.");

  const oPage = PageAfterEditProduct(aReq, aResp);
  aResp.redirect(303, oPage);
}

// The Producer should be fetched by the Product ID, because the user on the response can be
// a staff member
const wIsWholesaleProducer = async aIDProduct => {
  const oProducer = await wProducerFromIDProduct(aIDProduct);
  if (!oProducer) {
    console.error("wIsWholesaleProducer_error: Could not find producer record");
    return false;
  }
  return oProducer.CdRegWholesale === "Approv";
};
