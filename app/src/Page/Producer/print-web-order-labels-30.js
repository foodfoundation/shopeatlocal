// print-web-order-labels.js
// -------------------------
// Print Web Order Labels page controllers

import { wQtys } from "./web-order-labels.js";
import { wSend_LblsIt } from "../../Lbl.js";
import { Conn, wConnNew, wStApp, PhaseCycLess } from "../../Db.js";
import { Compare_Vty } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  let oIts;
  const oIDProducer = aResp.locals.CredImperUser.IDProducer;
  const oParams = {
    Producer: oIDProducer,
  };
  const oSQL = `INSERT INTO ProducerLabelHistory (ProducerId, LabelType)
			VALUES (:Producer, True)`;
  const [_oRows] = await Conn.wExecPrep(oSQL, oParams);

  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    const oStApp = await wStApp(oConn);
    if (PhaseCycLess(oStApp.CdPhaseCyc, "EndShop")) {
      await oConn.wRollback();

      aResp.Show_Flash("danger", null, aReq.t("common:printLabels.cannotPrintShoppingNotClosed"));

      aResp.redirect(303, "/web-order-labels");
      return;
    }

    const oQtys = await wQtys(oIDProducer, oConn);
    if (oQtys.QtyWgtUnset) {
      await oConn.wRollback();

      aResp.Show_Flash("danger", null, aReq.t("common:printLabels.mustEnterAllWeights"));

      aResp.redirect(303, "/web-order-labels");
      return;
    }

    oIts = await wIts(oConn, oIDProducer);

    if (!oIts.length) {
      await oConn.wRollback();

      aResp.Show_Flash("danger", null, aReq.t("common:printLabels.noLabelsToPrint"));

      aResp.redirect(303, "/web-order-labels");
      return;
    }

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    // So that the pipline exception handler sends the usual 500 response:
    throw aErr;
  } finally {
    oConn.Release();
  }

  // This doesn't work for the PDF: [TO DO]
  aResp.locals.Title = aReq.t("common:pageTitles.webOrderLabels", {
    name: CoopParams.CoopNameShort,
  });

  // This causes the PDF to be displayed in the browser, rather than downloaded:
  aResp.contentType("application/pdf");

  await wSend_LblsIt(aResp, oIts, true); //change after testing
}

async function wIts(aConn, aIDProducer) {
  const oRowsAll = [];

  function oAdd_Rows(aRows) {
    for (const oRow of aRows) {
      // Don't reference a specific shopper unless there is a note:
      if (oRow.NoteShop === null) {
        delete oRow.IDItCart;
        delete oRow.CdLoc;
        delete oRow.IDMemb;
        delete oRow.Name1First;
        delete oRow.Name1Last;
        delete oRow.Email1;
      }

      for (let o = 0; o < oRow.QtyProm; ++o) oRowsAll.push(oRow);
    }
  }

  // Variable-price items
  // --------------------
  // Like the fixed-price items, these are not associated with shoppers unless
  // they have notes! Because they are drawn from WgtLblOrdWeb, there is already
  // one record per label.

  // IDItCart will not be set in WgtLblOrdWeb unless the item bears a note.
  // Managed items should not appear in WgtLblOrdWeb, so it shouldn't be
  // necessary to check CkInvtMgd, but just in case:
  let oSQLWgt = `SELECT 1 AS QtyProm,
			WgtLblOrdWeb.IDVty, WgtLblOrdWeb.NoteShop, WgtLblOrdWeb.WgtPer,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Product.CdStor, Product.IDProduct, Product.NameProduct,
			Producer.IDProducer, Producer.NameBus,
			ItCart.IDItCart,
			Cart.CdLoc,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Email1
		FROM WgtLblOrdWeb
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		LEFT JOIN ItCart USING (IDItCart)
		LEFT JOIN Cart USING (IDCart)
		LEFT JOIN Memb ON Memb.IDMemb = Cart.IDMemb
		WHERE (Vty.CkInvtMgd IS FALSE)
			AND (IDProducer = ?)
			AND Vty.Upc IS NULL`;

  console.log(oSQLWgt);
  const [oRowsWgt] = await aConn.wExecPrep(oSQLWgt, [aIDProducer]);
  oAdd_Rows(oRowsWgt);

  // Fixed-price items with or without notes
  // ---------------------------------------
  // These have non-unit quantities.

  let oSQLFix = `SELECT ItCart.IDItCart, ItCart.QtyProm, ItCart.IDVty, ItCart.NoteShop,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Product.CdStor, Product.IDProduct, Product.NameProduct,
			Producer.IDProducer, Producer.NameBus,
			Cart.CdLoc,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Email1
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Memb ON Memb.IDMemb = Cart.IDMemb
		WHERE (Vty.CkInvtMgd IS FALSE)
			AND (Vty.Size IS NOT NULL)
			AND (IDProducer = ?)
			AND Vty.Upc IS NULL`;

  oSQLFix += ` ORDER BY ItCart.IDVty, ItCart.NoteShop, ItCart.IDItCart`;
  console.log(oSQLFix);
  const [oRowsFix] = await aConn.wExecPrep(oSQLFix, [aIDProducer]);
  oAdd_Rows(oRowsFix);

  oRowsAll.sort(Compare_Vty);
  return oRowsAll;
}
