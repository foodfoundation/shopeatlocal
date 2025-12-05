// onsite-order-summary.js
// ------------------------
// On-site order summary page controllers

import { wProducerFromID, Conn } from "../../Db.js";
import { Fmt_RowExcel, SaleNom } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // The optional URL parameter allows a specific producer to be selected, but
  // only staff can use that parameter, so I guess there is no need to worry
  // about a producer viewing another producer's data.

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  const [oVtys, oQtyTtl, oSaleNomTtl] = await wData(oIDProducer);
  aResp.locals.Vtys = oVtys;
  aResp.locals.QtyTtl = oQtyTtl;
  aResp.locals.SaleNomTtl = oSaleNomTtl;

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} on-site order summary`;
  aResp.render("Producer/onsite-order-summary");
}

export async function wHandGetExport(aReq, aResp) {
  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  const arrayOfExportData = await wIts(oIDProducer);
  for (const dataRow of arrayOfExportData) {
    if (!dataRow.CkAllowPublicName) {
      dataRow.IDMemb = "";
      dataRow.Name1First = "";
      dataRow.Name1Last = "";
      dataRow.Email1 = "";
    }
    Fmt_RowExcel(dataRow);
  }

  aResp.attachment("Onsite_order_summary.csv");
  aResp.csv(arrayOfExportData, true);
}

export async function wHandGetPicklist(aReq, aResp) {
  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  const arrayOfExportData = await wPicklist(oIDProducer);
  for (const dataRow of arrayOfExportData) {
    Fmt_RowExcel(dataRow);
  }

  aResp.attachment("Onsite_order_picklist.csv");
  aResp.csv(arrayOfExportData, true);
}

async function wData(aIDProducer) {
  const oVtys = [];
  let oVtyLast = null;

  const oIts = await wIts(aIDProducer);
  for (const oIt of oIts) {
    if (!oVtyLast || oIt.IDVty !== oVtyLast.IDVty) {
      oVtyLast = {
        IDVty: oIt.IDVty,
        Kind: oIt.Kind,
        Size: oIt.Size,
        WgtMin: oIt.WgtMin,
        WgtMax: oIt.WgtMax,
        PriceNomWeb: oIt.PriceNomWeb,
        IDProduct: oIt.IDProduct,
        NameProduct: oIt.NameProduct,
        QtyVty: 0,
        // On-site carts don't have shopper notes like web orders
        Shoppers: [],
      };
      oVtys.push(oVtyLast);
    }

    oVtyLast.QtyVty += oIt.Qty;

    // Track shopper info if available
    if (oIt.IDMemb) {
      oVtyLast.Shoppers.push({
        IDMemb: oIt.IDMemb,
        Name1First: oIt.Name1First,
        Name1Last: oIt.Name1Last,
        Email1: oIt.Email1,
        CkAllowPublicName: oIt.CkAllowPublicName,
        Qty: oIt.Qty,
      });
    }
  }

  let oQtyTtl = 0;
  let oSaleNomTtl = 0.0;
  for (const oVty of oVtys) {
    // We want these to match the producer inventory lines as far as possible,
    // so we will not subtract fees:
    oVty.SaleNom = SaleNom(oVty, "QtyVty", "PriceNomWeb");
    oQtyTtl += oVty.QtyVty;
    oSaleNomTtl += oVty.SaleNom;
  }

  return [oVtys, oQtyTtl, oSaleNomTtl];
}

async function wIts(aIDProducer) {
  const oSQL = `SELECT Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.PriceNomWeb,
			Product.IDProduct, Product.NameProduct,
			zItsCartOnsite.Qty,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Email1, Memb.CkAllowPublicName 
		FROM Vty
		JOIN Product USING (IDProduct)
		JOIN (
			SELECT Vty.IDVty,
				ItCartOnsite.IDCartOnsite,
				SUM(ItCartOnsite.Qty) AS Qty
			FROM ItCartOnsite
			JOIN CartOnsite CO ON ItCartOnsite.IDCartOnsite = CO.IDCartOnsite
			JOIN StApp ON CO.IDCyc = StApp.IDCyc
			JOIN Vty USING (IDVty)
			JOIN Product USING (IDProduct)
			WHERE IDProducer = :IDProducer
			GROUP BY IDVty, IDCartOnsite
		) AS zItsCartOnsite ON (zItsCartOnsite.IDVty = Vty.IDVty)
		LEFT JOIN CartOnsite CO ON (CO.IDCartOnsite = zItsCartOnsite.IDCartOnsite)
		LEFT JOIN Memb ON (Memb.IDMemb = CO.IDMembShop)
		ORDER BY Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty,
			Memb.Name1First, Memb.Name1Last, Memb.IDMemb`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

async function wPicklist(aIDProducer) {
  const oSQL = `
      SELECT Vty.IDVty,
             Vty.Kind,
             Vty.Size,
             Vty.WgtMin,
             Vty.WgtMax,
             Vty.PriceNomWeb,
             Product.IDProduct,
             Product.NameProduct,
             zItsCartOnsite.Qty
      FROM Vty
               JOIN Product USING (IDProduct)
               JOIN (SELECT Vty.IDVty,
                            SUM(ItCartOnsite.Qty) AS Qty
                     FROM ItCartOnsite
                              JOIN CartOnsite CO ON ItCartOnsite.IDCartOnsite = CO.IDCartOnsite
                              JOIN StApp ON CO.IDCyc = StApp.IDCyc
                              JOIN Vty USING (IDVty)
                              JOIN Product USING (IDProduct)
                     WHERE IDProducer = :IDProducer
                     GROUP BY IDVty) AS zItsCartOnsite ON (zItsCartOnsite.IDVty = Vty.IDVty)
      ORDER BY Product.NameProduct, 
               Product.IDProduct,
               Vty.Kind,
               Vty.Size,
               Vty.WgtMin,
               Vty.WgtMax,
               Vty.IDVty
  `;
  const oParams = {
    IDProducer: aIDProducer,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
