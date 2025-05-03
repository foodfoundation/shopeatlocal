// product-detail.js
// -----------------
// Product Detail page controllers
//
// This page needs a more specific name, otherwise it sounds like it might refer
// to the Product page that shoppers use. [TO DO]

import { wVtysQtyOrdCycFromIDProduct } from "../../Db.js";
import { IDCycPrevProducer } from "../../Util.js";
import { CoopParams } from "../../Site.js";
import { Conn } from "../../Db.js";

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

  const memberId = aResp.locals.CredImperUser.IDMemb;
  const [favRows] = await Conn.wExecPrep(
    `SELECT IDProduct
        FROM IMembFavorites
        WHERE IDMemb = :IDMemb AND IDProduct = :IDProduct`,
    { IDMemb: memberId, IDProduct: oIDProduct },
  );
  aResp.locals.Product.IsFavorited = favRows.length > 0;

  aResp.locals.Title = `${CoopParams.CoopNameShort} product detail`;
  aResp.render("Product/product-detail");
}
