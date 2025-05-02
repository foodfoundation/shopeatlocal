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

  // Fetch all images for this product
  const oImages = await wImages(oIDProduct);

  // Debug: verify what images were loaded
  console.log(`🖼️  Loaded images for product ${oIDProduct}:`, oImages);

  const oProduct = { ...oProductsRoll[0], ...oQtysWeb, Images: oImages };
  aResp.locals.Product = oProduct;

  aResp.locals.Title = `${oProduct.NameProduct} (${oProduct.NameBus})`;
  aResp.render("Shop/product");
}

async function wVtys(aIDProduct) {
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
  const oParams = { IDProduct: aIDProduct };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

export async function wImages(aIDProduct) {
  const oSQL = `
    SELECT FileName
      FROM ProductImage
     WHERE IDProduct = :IDProduct
  ORDER BY DisplayOrder ASC
  `;
  const oParams = { IDProduct: aIDProduct };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.map(row => row.FileName);
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
  const oParams = { IDProduct: aIDProduct };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  if (!oRows.length) throw Error("product wQtysWebProduct: No quantity record");
  return oRows[0];
}
