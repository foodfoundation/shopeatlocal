/** Hub Reports Module
 *  @module hub-reports
 *  @requires Db
 *  @requires Site
 */

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

/** GET handler for hub reports interface
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Renders hub reports view with producer data
 */
export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} Hub Reports`;
  const result = await wGetHubReport();
  aResp.locals.ProducerData = result;
  aResp.render("Cashier/hub-reports");
}

/** Retrieves aggregated sales data for all producers
 *  @returns {Promise<Object>} JSON object containing producer sales data
 *  @description Aggregates sales data including quantities, fees, taxes, and product details
 */
const wGetHubReport = async function () {
  const oSQL = `SELECT
    JSON_ARRAYAGG(
            JSON_OBJECT(
                    'saleSource',
                    saleSource,
                    'location',
                    NameLoc,
                    'QtyDeliv',
                    result.QtyDeliv,
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
                    'IDProducer',
                    IDProducer,
                    'Producer',
                    NameBus,
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
                Loc.NameLoc,
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
                Producer.IDProducer,
                Producer.NameBus,
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
                    JOIN Loc on Cart.CdLoc = Loc.CdLoc
            WHERE
                Cyc.IDCyc >= 300
        )
        UNION
            all (
            SELECT
                CONCAT('onsite') as saleSource,
                CONCAT('Franklin Plaza') as NameLoc,
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
                Producer.IDProducer,
                Producer.NameBus,
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
        )
    ) as result;`;
  const result = await Conn.wExecPrep(oSQL);
  const resultJson = JSON.stringify(result[0][0]["ProducerReport"]);
  return resultJson;
};
