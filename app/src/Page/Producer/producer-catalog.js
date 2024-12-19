// producer-catalog.js
// -------------------
// Producer Catalog page controllers

import { wVtysQtyOrdCycFromIDProduct, Conn } from "../../Db.js";
import { IDCycPrevProducer, Add_PropsProduct } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  const oProducts = await wProductsProducer(oIDProducer);

  // Add category/subcategory name combinations
  // ------------------------------------------

  oProducts.forEach(o => {
    o.TextCatSubcat = `${o.NameCat}: ${o.NameSubcat}`;
  });

  // Why not sort in the query?: [TO DO]
  oProducts.sort(function (aL, aR) {
    return aL.TextCatSubcat.localeCompare(aR.TextCatSubcat);
  });

  // Add variety records
  // -------------------
  // It would be faster to query the products and varieties together and then
  // 'roll' them up here, to produce the product/variety structure that the view
  // expects. [TO DO]

  const oIDCycPrev = IDCycPrevProducer(
    aResp.locals.StApp,
    aResp.locals.CycPrev,
    aResp.locals.CycCurr,
  );
  const oTasks = oProducts.map(async o => {
    o.Vtys = await wVtysQtyOrdCycFromIDProduct(o.IDProduct, oIDCycPrev);
  });
  await Promise.all(oTasks);

  // Add product properties
  // ----------------------

  Add_PropsProduct(oProducts);
  aResp.locals.Products = oProducts;

  // Render page
  // -----------

  aResp.locals.CoopParams = CoopParams;
  aResp.locals.Title = `${CoopParams.CoopNameShort} producer catalog`;
  aResp.render("Producer/producer-catalog");
}

/** Returns the specified producer's products. */
async function wProductsProducer(aIDProducer) {
  const oSQL = `SELECT Product.*,
			Producer.CdProducer, Producer.NameBus, Producer.NameImgProducer,
			Subcat.IDSubcat, Subcat.NameSubcat,
			Cat.IDCat, Cat.NameCat
		FROM Product
		LEFT JOIN Producer USING (IDProducer)
		LEFT JOIN Subcat USING (IDSubcat)
		LEFT JOIN Cat USING (IDCat)
		WHERE IDProducer = :IDProducer
		ORDER BY Product.NameProduct, Product.IDProduct`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
