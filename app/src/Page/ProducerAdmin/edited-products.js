// edited-products.js
// ------------------
// Edited Products page controllers

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // Structure by product
  // --------------------

  aResp.locals.Products = [];

  const oProductsVtys = await wProductsVtys();

  const oWhenLim = new Date();
  oWhenLim.setMonth(oWhenLim.getMonth() - 1);

  let oProductLast;
  for (const oProductVty of oProductsVtys) {
    if (!oProductLast || oProductVty.IDProduct != oProductLast.IDProduct) {
      oProductLast = {
        IDProducer: oProductVty.IDProducer,
        NameBus: oProductVty.NameBus,
        IDProduct: oProductVty.IDProduct,
        NameProduct: oProductVty.NameProduct,
        WhenEdit: oProductVty.WhenEditProduct,
        Vtys: [],
      };
      aResp.locals.Products.push(oProductLast);
    }

    if (oProductVty.WhenEditVty > oWhenLim)
      oProductLast.Vtys.push({
        IDVty: oProductVty.IDVty,
        Kind: oProductVty.Kind,
        Size: oProductVty.Size,
        WgtMin: oProductVty.WgtMin,
        WgtMax: oProductVty.WgtMax,
        PriceNomWeb: oProductVty.PriceNomWeb,
        WhenEdit: oProductVty.WhenEditVty,
      });
  }

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} edited products`;
  aResp.render("ProducerAdmin/edited-products");
}

async function wProductsVtys() {
  const oSQL = `SELECT Product.IDProduct, Product.NameProduct,
			Product.WhenEdit AS WhenEditProduct,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.PriceNomWeb,
			Vty.WhenEdit AS WhenEditVty,
			Producer.IDProducer, Producer.NameBus
		FROM Product
		JOIN Vty USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE (Product.WhenEdit >= DATE_SUB(NOW(), INTERVAL 1 MONTH))
			OR (Vty.WhenEdit >= DATE_SUB(NOW(), INTERVAL 1 MONTH))
		ORDER BY GREATEST(Product.WhenEdit, Vty.WhenEdit) DESC`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}
