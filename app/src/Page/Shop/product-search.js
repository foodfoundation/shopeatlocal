// product-search.js
// -----------------
// Product Search controllers

import { PathQuery, NamesParamProduct, wProducts, DataPage } from "../../Search.js";
import { CoopParams, Cats, Subcats } from "../../Site.js";
import { ArrayFromCds, CdsAttrProduct, wPopulateIsFavorited, wProducerFromID } from "../../Db.js";
import { CtProductPage } from "../../../Cfg.js";
import _ from "lodash";
import { wProductImages } from "./product.js";

export async function wHandGet(aReq, aResp) {
  /** Returns a path that adds the specified page number to the current search
   *  query, or 'undefined', if aIdxPage is undefined. */
  function PathPage(aIdxPage) {
    return aIdxPage === undefined
      ? undefined
      : PathQuery("/product-search", aReq.query, NamesParamProduct, aIdxPage);
  }

  if (aReq.query.favorites) {
    if (aReq.user) {
      aReq.query.IDMemb = aResp.locals.CredImperUser.IDMemb;
    } else {
      aResp.status(401);
      aResp.render("Misc/401");
      return;
    }
  }

  // Don't allow anyone to view another user's purchase history:
  if (aReq.query.CkPast) {
    if (aReq.user) aReq.query.IDMemb = aResp.locals.CredImperUser.IDMemb;
    else {
      aResp.status(401);
      aResp.render("Misc/401");
      return;
    }
  }

  const oIsMembEbtEligable = aResp.locals.CredUser?.CdRegEBT === "Approv";

  const { Ct: oCt, Products: oProducts } = await wProducts(aReq.query, oIsMembEbtEligable);
  const oDataPage = DataPage(aReq.query, oCt, CtProductPage);

  // if we know who the user is, pull their favorites and tag each product
  if (aResp.locals.CredImperUser?.IDMemb)
    await wPopulateIsFavorited(aResp.locals.CredImperUser.IDMemb, oProducts);

  aResp.locals.AttrsProduct = ArrayFromCds(CdsAttrProduct);
  aResp.locals.Title = aReq.t("common:search.productSearch", { name: CoopParams.CoopNameShort });
  aResp.locals.SummsParam = await wSummsParam(aReq.query, aReq.t);
  aResp.locals.Terms = aReq.query.Terms || "";
  aResp.locals.Products = oProducts;
  for (const Product of aResp.locals.Products) {
    const oImages = await wProductImages(Product.IDProduct);
    Product.Images = oImages;
  }
  aResp.locals.TextRg = oDataPage.Text;
  aResp.locals.PathPagePrev = PathPage(oDataPage.IdxPagePrev);
  aResp.locals.PathPageNext = PathPage(oDataPage.IdxPageNext);
  aResp.locals.CkPaging = aResp.locals.PathPagePrev || aResp.locals.PathPageNext;
  aResp.locals.MatchingAttrs = await findMatchingAttrs(aReq.query, aResp.locals.AttrsProduct);
  aResp.render("Shop/product-search");
}

export function HandPost(aReq, aResp) {
  console.log("aReq.body: ", aReq.body);
  const oPath = PathQuery("/product-search", aReq.body, NamesParamProduct);
  aResp.redirect(303, oPath);
}

async function findMatchingAttrs(queryObject, attrsArray) {
  var matchingArray = [];
  attrsArray.forEach(attr => {
    if (queryObject.hasOwnProperty("Ck" + attr.Cd)) {
      matchingArray.push("Ck" + attr.Cd);
    }
  });
  return matchingArray;
}

/** Returns an array of label/value objects that describe the search parameters,
 *  exclusive of the page index. */
async function wSummsParam(aParams, t) {
  const oKeysParam = Object.keys(aParams);
  const oCkNew =
    oKeysParam.length === 0 || (oKeysParam.length === 1 && oKeysParam[0] === "IdxPage");
  if (oCkNew) return [{ Lbl: t("common:search.newProducts") }];

  const oSumms = [];

  if (aParams.favorites) {
    oSumms.push({ Lbl: t("common:search.favorites") });
  }

  if (aParams.Terms)
    oSumms.push({
      Lbl: t("common:search.terms"),
      Val: aParams.Terms,
    });

  if (aParams.IDCat) {
    const oCat = Cats[aParams.IDCat];
    if (oCat)
      oSumms.push({
        Lbl: t("common:search.category"),
        Val: oCat.NameCat,
      });
  }

  if (aParams.IDSubcat) {
    const oSubcat = Subcats[aParams.IDSubcat];
    if (oSubcat)
      oSumms.push({
        Lbl: t("common:search.subcategory"),
        Val: oSubcat.NameSubcat,
      });
  }

  for (const oNameAttr in CdsAttrProduct) {
    if (aParams["Ck" + oNameAttr])
      oSumms.push({
        Lbl: CdsAttrProduct[oNameAttr].Text + " " + t("common:search.productsSuffix"),
      });
  }

  if (aParams.IDProducer) {
    const oProducer = await wProducerFromID(aParams.IDProducer);
    const oName = oProducer ? oProducer.NameBus : aParams.IDProducer;

    oSumms.push({
      Lbl: t("common:search.producer"),
      Val: oName,
    });
  }

  if (aParams.CkPast)
    oSumms.push({
      Lbl: t("common:search.pastPurchases"),
    });

  return oSumms;
}
