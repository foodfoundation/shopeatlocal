// edit-product.js
// ---------------
// Edit Product controllers

import _ from "lodash";
import { wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { wSubcatsProducer, ArrayFromCds, CdsAttrProduct } from "../../Db.js";
import { Add_Props, PageAfterEditProduct } from "../../Util.js";
import { CoopParams } from "../../Site.js";

/** Returns an object containing fields that should be disabled in the form, and
 *  ignored during form processing. */
function FldsDisab(aReq, aResp) {
  const oFlds = {};

  // This warning is displayed permanently in the view:

  if (aResp.PhaseCycEq("StartDeliv") || aResp.PhaseCycEq("EndDeliv")) {
    oFlds.CdStor = {
      Msg: "You cannot change the storage during the delivery cycle",
    };
  }

  const oCkStaff = aReq.user.CkStaff();
  if (!oCkStaff) {
    const oData = { Msg: "Only staff can change this setting." };
    oFlds.CkExcludeConsumerFee = oData;
    oFlds.CkExcludeProducerFee = oData;
  }

  return oFlds;
}

export async function wHandGet(aReq, aResp) {
  // This handler is also invoked after validation failures, so conserve the
  // user's previous input, if any:
  Add_Props(aResp.locals, aResp.locals.ProductSel);

  const oIDProducer = aResp.locals.ProductSel.IDProducer;
  aResp.locals.zCkProductOwn = aReq.user.IDProducer === oIDProducer;
  aResp.locals.Subcats = await wSubcatsProducer(oIDProducer);
  if (!aResp.locals.Subcats.length) {
    aResp.Show_Flash(
      "danger",
      "Cannot edit product!",
      "You must select one or more product categories in your producer " +
        "registration before you edit a product.",
    );
    aResp.redirect(303, "/edit-producer-registration");
    return;
  }
  aResp.locals.AttrsProduct = ArrayFromCds(CdsAttrProduct);
  aResp.locals.FldsDisab = FldsDisab(aReq, aResp);

  aResp.locals.Title = `${CoopParams.CoopNameShort} edit product`;
  console.log(aResp.locals);
  aResp.render("Product/edit-product");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  const oFlds = {
    NameProduct: { CkRequire: true },
    // I guess we won't require this, since so many are blank in the old
    // database:
    Descrip: { Valid: false },
    IDSubcat: { Valid: false },
    CdStor: {},
    CkAttrOrganCert: {},
    CkAttrNaturGrownCert: {},
    CkAttrRealOrganic: {},
    CkAttrRegenOrganCert: {},
    CkAttrCertBiodynamic: {},
    CkAttrAnimWelfareCert: {},
    CkAttrCert100GrassFed: {},
    CkAttrGlutenFreeCert: {},
    CkAttrVeganCert: {},
    CkAttrFairTradeCert: {},
    CkAttrLocalSelf: {},
    CkAttrFreeRgSelf: {},
    CkAttrPasturedSelf: {},
    CkAttrGrassFedSelf: {},
    CkAttrVegan: {},
    CkAttrVeget: {},
    CkAttrGlutenFree: {},
  };

  const oCkStaff = aReq.user.CkStaff();
  if (oCkStaff) {
    oFlds.CkExcludeConsumerFee = {};
    oFlds.CkExcludeProducerFee = {};
  }

  const oFldsDisab = FldsDisab(aReq, aResp);
  await wExec(aReq.body, oFlds, oFldsDisab);

  // Image upload
  // ------------

  // If the user selected a 'new' file, use that. Otherwise, use the previously-
  // selected file, unless the user opted to remove it:
  let oNameImg;
  if (aReq.files && aReq.files["Img"] && aReq.files["Img"].length > 0)
    oNameImg = aReq.files["Img"][0].filename;
  else if (aReq.body.CkRemImg) oNameImg = null;
  else if (aReq.body.NameImgProduct) oNameImg = aReq.body.NameImgProduct;
  else oNameImg = null;

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);
    aResp.locals.NameImgProduct = oNameImg;

    wHandGet(aReq, aResp);
    return;
  }

  // Update product record
  // ---------------------
  // So using this page to change the listing status will cause the edit time to
  // be updated? [TO DO]

  const oParamsEx = {
    NameImgProduct: oNameImg,
    WhenEdit: new Date(),
  };

  const oIDProduct = aResp.locals.ProductSel.IDProduct;
  await wUpdOne("Product", "IDProduct", oIDProduct, oFlds, oParamsEx);

  // Returns to previous page
  // ------------------------

  aResp.Show_Flash("success", null, "The product has been updated.");

  const oPage = PageAfterEditProduct(aReq, aResp);
  aResp.redirect(303, oPage);
}
