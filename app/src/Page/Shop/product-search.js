// product-search.js
// -----------------
// Product Search controllers

import { PathQuery, NamesParamProduct, wProducts, DataPage } from "../../Search.js";
import { CoopParams, Cats, Subcats } from "../../Site.js";
import { ArrayFromCds, CdsAttrProduct, wProducerFromID } from "../../Db.js";
import { CtProductPage } from "../../../Cfg.js";
import _ from "lodash";

export async function wHandGet(aReq, aResp) {
  /** Returns a path that adds the specified page number to the current search
   *  query, or 'undefined', if aIdxPage is undefined. */
  function PathPage(aIdxPage) {
    return aIdxPage === undefined
      ? undefined
      : PathQuery("/product-search", aReq.query, NamesParamProduct, aIdxPage);
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

  const { Ct: oCt, Products: oProducts } = await wProducts(aReq.query, oIsMembEbtEligable); //aReq.query includes terms if a term was searched
  const oDataPage = DataPage(aReq.query, oCt, CtProductPage);

  aResp.locals.AttrsProduct = ArrayFromCds(CdsAttrProduct);
  aResp.locals.Title = `${CoopParams.CoopNameShort} product search`;
  aResp.locals.SummsParam = await wSummsParam(aReq.query);
  console.log(aResp.locals.SummsParam);
  aResp.locals.Terms = aReq.query.Terms || "";
  aResp.locals.Products = oProducts;
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
async function wSummsParam(aParams) {
  const oKeysParam = Object.keys(aParams);
  const oCkNew =
    oKeysParam.length === 0 || (oKeysParam.length === 1 && oKeysParam[0] === "IdxPage");
  if (oCkNew) return [{ Lbl: "New products" }];

  const oSumms = [];

  if (aParams.Terms)
    oSumms.push({
      Lbl: "Terms",
      Val: aParams.Terms,
    });

  if (aParams.IDCat) {
    const oCat = Cats[aParams.IDCat];
    if (oCat)
      oSumms.push({
        Lbl: "Category",
        Val: oCat.NameCat,
      });
  }

  if (aParams.IDSubcat) {
    const oSubcat = Subcats[aParams.IDSubcat];
    if (oSubcat)
      oSumms.push({
        Lbl: "Subcategory",
        Val: oSubcat.NameSubcat,
      });
  }

  for (const oNameAttr in CdsAttrProduct) {
    if (aParams["Ck" + oNameAttr])
      oSumms.push({
        Lbl: CdsAttrProduct[oNameAttr].Text + " products",
      });
  }

  if (aParams.IDProducer) {
    const oProducer = await wProducerFromID(aParams.IDProducer);
    const oName = oProducer ? oProducer.NameBus : aParams.IDProducer;

    oSumms.push({
      Lbl: "Producer",
      Val: oName,
    });
  }

  if (aParams.CkPast)
    oSumms.push({
      Lbl: "Past purchases",
    });

  return oSumms;
}
