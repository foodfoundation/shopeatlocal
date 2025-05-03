// product.js
// ----------
// Product page controllers

import { ProductsVtysRoll } from "../../Search.js";
import { Conn } from "../../Db.js";

export async function wHandGet(aReq, aResp) {
  const oIDProduct = aResp.locals.ProductSel.IDProduct;
  const oVtys = await wVtys(oIDProduct);
  // Every product should have at least one variety, but just in case:
  if (!oVtys.length) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oIsMembEbtEligable = aResp.locals.CredUser?.CdRegEBT === "Approv";

  const oQtysWeb = await wQtysWebProduct(oIDProduct);

  const oProductsRoll = ProductsVtysRoll(oVtys, oIsMembEbtEligable);
  if (oProductsRoll.length !== 1) throw Error("product wHandGet: Cannot get product");

  const oProduct = { ...oProductsRoll[0], ...oQtysWeb };

  const memberId = aResp.locals.CredImperUser?.IDMemb;
  if (memberId) {
    const [favRows] = await Conn.wExecPrep(
      `SELECT IDProduct
        FROM IMembFavorites
       WHERE IDMemb = :IDMemb AND IDProduct = :IDProduct`,
      { IDMemb: memberId, IDProduct: oIDProduct },
    );
    oProduct.IsFavorited = favRows.length > 0;
  }

  aResp.locals.Product = oProduct;

  aResp.locals.Title = oProduct.NameProduct + " (" + oProduct.NameBus + ")";
  aResp.render("Shop/product");
}

async function wVtys(aIDProduct) {
  // We are including unlisted varieties because they could have been unlisted
  // after being added to someone's cart. They are excluded from product
  // searches. For a time I also excluded archived varieties, but we'll display
  // those after all:
  const oSQL = `SELECT Product.*,
			Vty.*,
			IFNULL(zItCartVty.QtyProm, 0) AS QtyProm,
			Producer.CdProducer, Producer.NameBus, Producer.NameImgProducer,
			Subcat.IDSubcat, Subcat.NameSubcat,
			Cat.IDCat, Cat.NameCat
		FROM Product
		LEFT JOIN Vty USING (IDProduct)
		LEFT JOIN Producer USING (IDProducer)
		LEFT JOIN Subcat USING (IDSubcat)
		LEFT JOIN Cat USING (IDCat)
		LEFT JOIN (
			SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
			FROM Vty
			JOIN ItCart USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY Vty.IDVty
		) AS zItCartVty USING (IDVty)
		WHERE (IDProduct = :IDProduct)
		ORDER BY Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDProduct: aIDProduct,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Returns the total listed variety offer and promise quantities for the
 *  specified product, or zeros if the product is not found. */
async function wQtysWebProduct(aIDProduct) {
  const oSQL = `SELECT IFNULL(SUM(Vty.QtyOffer), 0) AS QtyOfferWebProduct,
			IFNULL(SUM(zItCart.QtyProm), 0) AS QtyPromWebProduct
		FROM Vty
		LEFT JOIN (
			SELECT ItCart.IDVty, SUM(ItCart.QtyProm) AS QtyProm
			FROM ItCart
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY ItCart.IDVty
		) AS zItCart USING (IDVty)
		WHERE (Vty.IDProduct = :IDProduct)
			AND (Vty.CkListWeb IS TRUE)`;
  const oParams = {
    IDProduct: aIDProduct,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  if (!oRows.length) throw Error("product wQtysWebProduct: No quantity record");
  return oRows[0];
}
