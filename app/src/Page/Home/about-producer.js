// about-producer.js
// -----------------
// About Producer page controllers

import { ProductsVtysRoll } from "../../Search.js";
import { wProducerFromID, Conn, wPopulateIsFavorited } from "../../Db.js";
import {wProductImages} from "../Shop/product.js";

export async function wHandGet(aReq, aResp) {
  const oIDProducer = aReq.params.IDProducerView;
  const oProducer = await wProducerFromID(oIDProducer);
  if (!oProducer) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }
  Object.assign(aResp.locals, oProducer);

  const oIsMembEbtEligable = aResp.locals.CredUser?.CdRegEBT === "Approv";
  aResp.locals.Products = await wProducts(oIDProducer, oIsMembEbtEligable);

  const oImages = await wProducerImages(oIDProducer);

  // Debug: verify what images were loaded
  console.log(`�️  Loaded images for producer ${oIDProducer}:`, oImages);

  aResp.locals.Images = oImages;
  if (aResp.locals.CredImperUser?.IDMemb)
    await wPopulateIsFavorited(aResp.locals.CredImperUser.IDMemb, aResp.locals.Products);

  aResp.locals.Title = "About " + oProducer.NameBus;
  aResp.render("Home/about-producer");
}

async function wProducts(aIDProducer, aIsMembEbtEligable) {
  // I'm allowing listed zero-offer-quantity items so the user can learn more
  // about the producer:
  const oSQL = `SELECT zProductAvail.*,
                       Vty.IDVty,
                       Vty.Kind,
                       Vty.Size,
                       Vty.WgtMin,
                       Vty.WgtMax,
                       Vty.CkListWeb,
                       Vty.CkListOnsite,
                       Vty.QtyOffer,
                       Vty.PriceNomWeb,
                       IFNULL(zItCartVty.QtyProm, 0) AS QtyProm
                FROM (SELECT SUM(Vty.QtyOffer)                 AS QtyOfferWebProduct,
                             IFNULL(zItCartProduct.QtyProm, 0) AS QtyPromWebProduct,
                             SUM(Vty.QtyOffer - IFNULL(zItCartProduct.QtyProm, 0))
                                                               AS QtyAvailWebProduct,
                             Product.IDProduct,
                             0                                 AS Score,
                             Product.NameProduct,
                             Product.Descrip,
                             Product.NameImgProduct,
                             Product.CkAttrVegan,
                             Product.CkAttrVeget,
                             Product.CkAttrGlutenFreeCert,
                             Product.CkAttrFairTradeCert,
                             Product.CkAttrOrganCert,
                             Product.CkAttrNaturGrownCert,
                             Product.CkAttrNaturGrownSelf,
                             Product.CkAttrIntegPestMgmtSelf,
                             Product.CkAttrAnimWelfareCert,
                             Product.CkAttrFreeRgSelf,
                             Product.CkAttrCageFreeSelf,
                             Product.CkAttrGrassFedSelf,
                             Product.CkAttrHormAntibFreeSelf,
                             Product.WhenCreate,
                             Producer.IDProducer,
                             Producer.NameBus,
                             Producer.NameImgProducer,
                             Subcat.IDSubcat,
                             Subcat.NameSubcat,
                             Cat.IDCat,
                             Cat.NameCat
                      FROM Vty
                             JOIN Product USING (IDProduct)
                             JOIN Producer USING (IDProducer)
                             JOIN Subcat USING (IDSubcat)
                             JOIN Cat USING (IDCat)
                             LEFT JOIN (SELECT Product.IDProduct, SUM(ItCart.QtyProm) AS QtyProm
                                        FROM Product
                                               JOIN Vty USING (IDProduct)
                                               JOIN ItCart USING (IDVty)
                                               JOIN Cart USING (IDCart)
                                               JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
                                        GROUP BY Product.IDProduct) AS zItCartProduct USING (IDProduct)
                      WHERE Vty.CkListWeb IS TRUE
                        AND Producer.IDProducer = :IDProducer
                      GROUP BY Product.IDProduct) AS zProductAvail
                       JOIN Vty USING (IDProduct)
                       LEFT JOIN (SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
                                  FROM Vty
                                         JOIN ItCart USING (IDVty)
                                         JOIN Cart USING (IDCart)
                                         JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
                                  GROUP BY Vty.IDVty) AS zItCartVty USING (IDVty)
                WHERE Vty.CkListWeb IS TRUE
                ORDER BY QtyAvailWebProduct DESC, zProductAvail.WhenCreate DESC,
                         Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;


  const oParams = {
    IDProducer: aIDProducer,
  };

  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, oParams);
  return ProductsVtysRoll(oRows, aIsMembEbtEligable);
}

  export async function wProducerImages(aIDProducer) {
    const oSQL = `
      SELECT FileName
      FROM ProducerImage
      WHERE IDProducer = :IDProducer
      ORDER BY DisplayOrder ASC
    `;
    const oParams = {IDProducer: aIDProducer};
    const [oRows] = await Conn.wExecPrep(oSQL, oParams);
    return oRows.map(row => row.FileName);
  }



