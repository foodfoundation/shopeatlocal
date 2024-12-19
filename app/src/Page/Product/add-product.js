// add-product.js
// --------------
// Add Product controllers

import {
  wExec,
  Upd_FldsVtyPriceVar,
  Valid_FldsVtyPriceVar,
  CkFail,
  Retry,
  wIns,
} from "../../Form.js";
import { wSubcatsProducer, ArrayFromCds, CdsAttrProduct, wProducerFromID } from "../../Db.js";
import { PageAfterEditProduct } from "../../Util.js";
import { CoopParams } from "../../Site.js";

function wFldsDisabledPost(aReq, aIsWholesaleProducer, aIsWholesaleVarietyType) {
  const oCkStaff = aReq.user.CkStaff();
  const oFlds = {};

  if (!oCkStaff) {
    const oData = {
      Msg: `Only ${CoopParams.CoopNameShort} staff can change this setting.`,
    };
    oFlds.CkListOnsite = oData;
    oFlds.CkInvtMgd = oData;
    oFlds.CkInvtMgdNext = oData;
    oFlds.CkExcludeConsumerFee = oData;
    oFlds.CkExcludeProducerFee = oData;
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
      const oData = { Msg: "Only IFC staff  can change this setting." };
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
    oFlds.CkExcludeConsumerFee = oData;
    oFlds.CkExcludeProducerFee = oData;
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
  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  aResp.locals.Subcats = await wSubcatsProducer(oIDProducer);
  const oIsWholesaleProducer = await wIsWholesaleProducer(oIDProducer);
  if (!aResp.locals.Subcats.length) {
    aResp.Show_Flash(
      "danger",
      "Cannot add product!",
      "You must select one or more product categories in your producer " +
        "registration before you add a product.",
    );
    aResp.redirect(303, "/edit-producer-registration");
    return;
  }
  aResp.locals.IsWholesaleProducer = oIsWholesaleProducer;
  aResp.locals.AttrsProduct = ArrayFromCds(CdsAttrProduct);
  aResp.locals.FldsDisab = FldsDisabledGet(aReq, oIsWholesaleProducer);

  aResp.locals.Title = `${CoopParams.CoopNameShort} add product`;
  aResp.render("Product/add-product");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------
  // We cannot conditionally add Size or WgtMin and WgtMax because we do not
  // know yet whether the variety is variably-priced. Instead, properties will
  // be deleted by gForm.Upd_FldsVtyPriceVar, below.
  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  const oIsWholesaleVarietyType = aReq.body.CdVtyType === "Wholesale";
  const oIsWholesaleProducer = await wIsWholesaleProducer(oIDProducer);

  const oFlds = {
    // Product fields:
    NameProduct: { CkRequire: true, Store: "Product" },
    // I guess we won't require this, since so many are blank in the old
    // database:
    Descrip: { Valid: false, Store: "Product" },
    IDSubcat: { Valid: false, Store: "Product" },
    CdStor: { Store: "Product" },

    CkAttrOrganCert: { Store: "Product" },
    CkAttrNaturGrownCert: { Store: "Product" },
    CkAttrRealOrganic: { Store: "Product" },
    CkAttrRegenOrganCert: { Store: "Product" },
    CkAttrCertBiodynamic: { Store: "Product" },
    CkAttrAnimWelfareCert: { Store: "Product" },
    CkAttrCert100GrassFed: { Store: "Product" },
    CkAttrGlutenFreeCert: { Store: "Product" },
    CkAttrVeganCert: { Store: "Product" },
    CkAttrFairTradeCert: { Store: "Product" },
    CkAttrLocalSelf: { Store: "Product" },
    CkAttrFreeRgSelf: { Store: "Product" },
    CkAttrPasturedSelf: { Store: "Product" },
    CkAttrGrassFedSelf: { Store: "Product" },
    CkAttrVegan: { Store: "Product" },
    CkAttrVeget: { Store: "Product" },
    CkAttrGlutenFree: { Store: "Product" },

    // Variety fields:
    CkListWeb: { Store: "Vty" },
    CkArchiv: { Store: "Vty" },
    Kind: { Valid: false, Store: "Vty" },
    CkPriceVar: { CkRequire: true, Store: false },
    Size: { Valid: false, Store: "Vty" },
    WgtMin: { Store: "Vty" },
    WgtMax: { Store: "Vty" },
    PriceNomWeb: { CkRequire: true, Store: "Vty" },
    PriceNomWebNext: { CkRequire: true, Store: "Vty" },
    QtyOffer: { CkRequire: true, Store: "Vty" },
  };

  const oCkStaff = aReq.user.CkStaff();
  if (oCkStaff) {
    oFlds.CkInvtMgd = { CkRequire: true, Store: "Vty" };
    oFlds.CkInvtMgdNext = { CkRequire: true, Store: "Vty" };
    oFlds.CkExcludeConsumerFee = { Store: "Product" };
    oFlds.CkExcludeProducerFee = { Store: "Product" };
  }

  if (oIsWholesaleProducer) {
    oFlds.CdVtyType = { CkRequire: true, Store: "Vty" };
  }

  if (oCkStaff || (oIsWholesaleProducer && oIsWholesaleVarietyType)) {
    oFlds.CkListOnsite = { Store: "Vty" };
    oFlds.QtyOnsite = { CkRequire: true, Store: "Vty" };
    oFlds.PriceNomOnsite = { CkRequire: true, Store: "Vty" };
  }

  const oFldsDisab = wFldsDisabledPost(aReq, oIsWholesaleProducer, oIsWholesaleVarietyType);

  await wExec(aReq.body, oFlds, oFldsDisab);
  await wExec(aReq.body, oFlds, oFldsDisab);

  // Image upload
  // ------------
  // It would be nice to prevent users from uploading files with unwanted
  // extensions, but this 'second channel' upload design makes that difficult,
  // and it wouldn't prevent users from uploading files with extensions that
  // fail to match their content.

  // If the user selected a 'new' file, use that. Otherwise, use the previously-
  // selected file, unless the user opted to remove it:
  let oNameImg;
  if (aReq.files && aReq.files["Img"] && aReq.files["Img"].length > 0)
    oNameImg = aReq.files["Img"][0].filename;
  else if (aReq.body.CkRemImg) oNameImg = null;
  else if (aReq.body.NameImgProduct) oNameImg = aReq.body.NameImgProduct;
  else oNameImg = null;

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
    aResp.locals.NameImgProduct = oNameImg;

    wHandGet(aReq, aResp);
    return;
  }

  // Create product record
  // ---------------------
  // The product and variety inserts should be performed in a transaction.
  // [TO DO]

  const oParamsExProduct = {
    IDProducer: oIDProducer,
    NameImgProduct: oNameImg,
  };

  const oIDProduct = await wIns("Product", oFlds, oParamsExProduct);
  if (!oIDProduct) throw Error("wHandPost: Could not create product record");

  // Create variety record
  // ---------------------

  const oParamsExVty = {
    IDProduct: oIDProduct,
  };

  // The default on-site quantity is zero. There is no sensible default for the
  // price, however:
  if (!oCkStaff && !(oIsWholesaleProducer && oIsWholesaleVarietyType))
    oParamsExVty.PriceNomOnsite = oFlds.PriceNomWeb.ValCook;

  const oIDVty = await wIns("Vty", oFlds, oParamsExVty);
  if (!oIDVty) throw Error("wHandPost: Could not create variety record");

  // Go to Product Detail
  // --------------------

  aResp.Show_Flash("success", "Success!", "The product has been added.");

  const oPage = PageAfterEditProduct(aReq, aResp);
  aResp.redirect(303, oPage);
}

const wIsWholesaleProducer = async aIDProducer => {
  const oProducer = await wProducerFromID(aIDProducer);
  if (!oProducer) {
    console.error("wIsWholesaleProducer_error: Could not find producer record");
    return false;
  }
  return oProducer.CdRegWholesale === "Approv";
};
