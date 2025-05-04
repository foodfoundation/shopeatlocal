// product-detail.js
// -----------------
// Product Detail page controllers
//
// This page needs a more specific name, otherwise it sounds like it might refer
// to the Product page that shoppers use. [TO DO]

import { wPopulateIsFavorited, wVtysQtyOrdCycFromIDProduct } from "../../Db.js";
import { IDCycPrevProducer } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import { wProductImages } from "../Shop/product.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Product = { ...aResp.locals.ProductSel };

  const oIDProduct = aResp.locals.Product.IDProduct;
  const oIDCycPrev = IDCycPrevProducer(
    aResp.locals.StApp,
    aResp.locals.CycPrev,
    aResp.locals.CycCurr,
  );
  const oVtys = await wVtysQtyOrdCycFromIDProduct(oIDProduct, oIDCycPrev);
  aResp.locals.Product.Vtys = oVtys;

  if (aResp.locals.CredImperUser?.IDMemb)
    await wPopulateIsFavorited(aResp.locals.CredImperUser.IDMemb, [aResp.locals.Product]);
  // Fetch all images for this product
  const oImages = await wProductImages(oIDProduct);

  const oProduct = { ...aResp.locals.Product, Images: oImages };
  aResp.locals.Product = oProduct;

  aResp.locals.Title = `${CoopParams.CoopNameShort} product detail`;
  aResp.render("Product/product-detail");
}
