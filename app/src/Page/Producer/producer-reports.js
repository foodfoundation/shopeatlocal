// producer-reports.js
// -------------------
// Web Order Labels page controllers

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.producerReports", { name: CoopParams.CoopNameShort });
  const producerId = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.ProducerId = producerId;
  const result = await wGetProducerReport(producerId);
  aResp.locals.ProducerData = result;
  aResp.render("Producer/producer-reports");
}

/** Returns a JSON object representing all sales of the indicated producer
 *
 * The json is consumed by the Frontend Application and should generally be considered opaque
 */
const wGetProducerReport = async function (producerId) {
  const oSQL = `SELECT
    JSON_ARRAYAGG(
            JSON_OBJECT(
                    'saleSource',
                    saleSource,
                    'QtyDeliv',
                    QtyDeliv,
                    'SaleNom',
                    SaleNom,
                    'FeeCoop',
                    FeeCoop,
                    'FeeCoopForgiv',
                    FeeCoopForgiv,
                    'TaxSale',
                    TaxSale,
                    'IDVty',
                    IDVty,
                    'IDCyc',
                    IDCyc,
                    'NameCat',
                    NameCat,
                    'NameSubcat',
                    NameSubcat,
                    'NameProduct',
                    NameProduct,
                    'IDProduct',
                    IDProduct,
                    'IDMemb',
                    IDMemb,
                    'CustomerName',
                    CustomerName,
                    'CustEmail',
                    CustEmail,
                    'CustPhone',
                    CustPhone
                )
        ) as ProducerReport
from
    (
        (
            SELECT
                CONCAT('web') as saleSource,
                ItCart.QtyDeliv,
                ItCart.SaleNom,
                ItCart.FeeCoop,
                ItCart.FeeCoopForgiv,
                ItCart.TaxSale,
                CONCAT(0) as FeeCoopProducer,
                CONCAT(0) as FeeInvt,
                Vty.IDVty,
                Cyc.IDCyc,
                Cat.NameCat,
                Subcat.NameSubcat,
                Product.NameProduct,
                Product.IDProduct,
                Memb.IDMemb,
                IF(Memb.CkAllowPublicName, CONCAT(Memb.Name1First, ' ',  Memb.Name1Last), '-') as CustomerName,
                IF(Memb.CkAllowPublicName, Memb.Email1, '-') as CustEmail,
                IF(Memb.CkAllowPublicName, Memb.Phone1, '-') as CustPhone
            FROM
                ItCart
                    JOIN Cart ON ItCart.IDCart = Cart.IDCart
                    JOIN Cyc ON Cart.IDCyc = Cyc.IDCyc
                    JOIN Vty ON ItCart.IDVty = Vty.IDVty
                    JOIN Product ON Vty.IDProduct = Product.IDProduct
                    JOIN Subcat ON Product.IDSubcat = Subcat.IDSubcat
                    JOIN Cat ON Subcat.IDCat = Cat.IDCat
                    JOIN Producer ON Product.IDProducer = Producer.IDProducer
                    JOIN Memb ON Cart.IDMemb = Memb.IDMemb
            WHERE
                    Producer.IDProducer = :IDProducer
        )
        UNION
            all (
            SELECT
                CONCAT('onsite') as saleSource,
                ItCartOnsite.Qty as QtyDeliv,
                ItCartOnsite.SaleNom,
                ItCartOnsite.FeeCoopShop,
                ItCartOnsite.FeeCoopShopForgiv,
                ItCartOnsite.TaxSale,
                ItCartOnsite.FeeCoopProducer,
                ItCartOnsite.FeeInvt,
                ItCartOnsite.IDVty,
                Cyc.IDCyc,
                Cat.NameCat,
                Subcat.NameSubcat,
                Product.NameProduct,
                Product.IDProduct,
                Memb.IDMemb,
                IF(Memb.CkAllowPublicName, CONCAT(Memb.Name1First, ' ',  Memb.Name1Last), '-') as CustomerName,
                IF(Memb.CkAllowPublicName, Memb.Email1, '-') as CustEmail,
                IF(Memb.CkAllowPublicName, Memb.Phone1, '-') as CustPhone
            FROM
                ItCartOnsite
                    JOIN CartOnsite CO ON ItCartOnsite.IDCartOnsite = CO.IDCartOnsite
                    JOIN Cyc ON CO.IDCyc = Cyc.IDCyc
                    JOIN Vty ON ItCartOnsite.IDVty = Vty.IDVty
                    JOIN Product ON Vty.IDProduct = Product.IDProduct
                    JOIN Subcat ON Product.IDSubcat = Subcat.IDSubcat
                    JOIN Cat ON Subcat.IDCat = Cat.IDCat
                    JOIN Producer ON Product.IDProducer = Producer.IDProducer
                    JOIN Memb ON CO.IDMembShop = Memb.IDMemb
            WHERE
                    Producer.IDProducer = :IDProducer
        )
    ) as result;`;
  const oParams = {
    IDProducer: producerId,
  };
  const result = await Conn.wExecPrep(oSQL, oParams);
  const resultJson = JSON.stringify(result[0][0]["ProducerReport"]);
  return resultJson;
};
