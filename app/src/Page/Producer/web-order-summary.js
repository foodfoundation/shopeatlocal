// web-order-summary.js
// --------------------
// Web order summary page controllers

import { wProducerFromID, Conn } from "../../Db.js";
import { Fmt_RowExcel, SaleNom } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // The optional URL parameter allows a specific producer to be selected, but
  // only staff can use that parameter, so I guess there is no need to worry
  // about a producer viewing another producer's data.

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  const [oVtys, oQtyPromTtl, oSaleNomTtl] = await wData(oIDProducer);
  aResp.locals.Vtys = oVtys;
  aResp.locals.QtyPromTtl = oQtyPromTtl;
  aResp.locals.SaleNomTtl = oSaleNomTtl;

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} web order summary`;
  aResp.render("Producer/web-order-summary");
}

export async function wHandGetExport(aReq, aResp) {
  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  const arrayOfExportData = await wIts(oIDProducer);
  for (const dataRow of arrayOfExportData) {
    Fmt_RowExcel(dataRow);
  }

  aResp.attachment("Web_order_summary.csv");
  aResp.csv(arrayOfExportData, true);
}

export async function wHandGetPicklist(aReq, aResp) {
  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  aResp.locals.Producer = await wProducerFromID(oIDProducer);

  const arrayOfExportData = await wPicklist(oIDProducer);
  for (const dataRow of arrayOfExportData) {
    Fmt_RowExcel(dataRow);
  }

  aResp.attachment("Web_order_picklist.csv");
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
        CkInvtMgd: oIt.CkInvtMgd,
        CkPriceVar: oIt.CkPriceVar,
        PriceNomWeb: oIt.PriceNomWeb,
        IDProduct: oIt.IDProduct,
        NameProduct: oIt.NameProduct,

        QtyPromVty: 0,

        // It's not enough to check the number of NotesShop elements. It could
        // contain a single no-note element, in which no note lines should be
        // displayed, or all items could bear the same note, in which case a
        // single note line should appear:
        CkNotesShop: false,
        NotesShop: [],
      };
      oVtys.push(oVtyLast);
    }

    oVtyLast.QtyPromVty += oIt.QtyProm;

    const oNoteShop = {
      NoteShop: oIt.NoteShop,
      QtyPromNote: oIt.QtyProm,
    };
    if (oIt.IDMemb) {
      oVtyLast.CkNotesShop = true;

      oNoteShop.Memb = {
        IDMemb: oIt.IDMemb,
        Name1First: oIt.Name1First,
        Name1Last: oIt.Name1Last,
        Email1: oIt.Email1,
        CkAllowPublicName: oIt.CkAllowPublicName,
      };
    }
    oVtyLast.NotesShop.push(oNoteShop);
  }

  let oQtyPromTtl = 0;
  let oSaleNomTtl = 0.0;
  for (const oVty of oVtys) {
    // We want these to match the producer inventory lines as far as possible,
    // so we will not subtract fees:
    oVty.SaleNom = SaleNom(oVty, "QtyPromVty", "PriceNomWeb");
    oQtyPromTtl += oVty.QtyPromVty;
    oSaleNomTtl += oVty.SaleNom;
  }

  return [oVtys, oQtyPromTtl, oSaleNomTtl];
}

async function wIts(aIDProducer) {
  const oSQL = `SELECT Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkInvtMgd, IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Vty.PriceNomWeb,
			Product.IDProduct, Product.NameProduct,
			zItsCart.NoteShop, zItsCart.QtyProm,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Email1, Memb.CkAllowPublicName
		FROM Vty
		JOIN Product USING (IDProduct)
		JOIN (
			SELECT Vty.IDVty,
				ItCart.NoteShop,
				ItCart.IDCart AS IDCartNote,
				SUM(ItCart.QtyProm) AS QtyProm
			FROM ItCart
			JOIN Cart USING (IDCart)
			JOIN StApp USING (IDCyc)
			JOIN Vty USING (IDVty)
			JOIN Product USING (IDProduct)
			WHERE IDProducer = :IDProducer
			GROUP BY IDVty, NoteShop, IDCartNote
		) AS zItsCart ON (zItsCart.IDVty = Vty.IDVty)
		LEFT JOIN Cart ON (Cart.IDCart = zItsCart.IDCartNote)
		LEFT JOIN Memb USING (IDMemb)
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
             Vty.CkInvtMgd,
             IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
             Vty.PriceNomWeb,
             Product.IDProduct,
             Product.NameProduct,
             zItsCart.QtyProm
      FROM Vty
               JOIN Product USING (IDProduct)
               JOIN (SELECT Vty.IDVty,
                            ItCart.NoteShop,
                            SUM(ItCart.QtyProm) AS QtyProm
                     FROM ItCart
                              JOIN Cart USING (IDCart)
                              JOIN StApp USING (IDCyc)
                              JOIN Vty USING (IDVty)
                              JOIN Product USING (IDProduct)
                     WHERE IDProducer = :IDProducer
                     GROUP BY IDVty,
                              NoteShop) AS zItsCart ON (zItsCart.IDVty = Vty.IDVty)
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
