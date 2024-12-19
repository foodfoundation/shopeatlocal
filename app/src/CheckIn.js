// CheckIn.js
// ==========
// Producer check-in operations

import { wCreate } from "./InvcProducerWeb.js";
import { Site } from "./Site.js";
import { wLock_CycStApp, wProducerFromID, getProductRowFromIDItDeliv } from "./Db.js";
import { CtDigitCurrAcct } from "./Util.js";

import _ from "lodash";
const { round } = _;

/** Processes producer check-in with delivery quantities.
 *  @param {Object} aConn - Database connection
 *  @param {number} aIDProducer - Producer ID
 *  @param {Array} aItsDeliv - Delivery items with IDItDeliv and QtyDeliv/WgtPer
 *  @returns {Object} Contains IDInvc on success or MsgFail on validation error
 */
export async function wExec(aConn, aIDProducer, aItsDeliv) {
  // Validate cycle phase
  // -------------------
  const oCycStApp = await wLock_CycStApp(aConn);
  if (oCycStApp.CdPhaseCyc !== "StartDeliv") return { MsgFail: "OutWinDeliv" };

  // Process delivery items
  // --------------------
  // Note: ItDeliv uses auto-increment IDItDeliv as primary key
  // Updates are handled by delete-then-insert operations
  // If ItDeliv is modified while form is open:
  // 1. Form's IDItDeliv values may reference deleted records
  // 2. Update operations will affect 0 rows
  // 3. Function returns 'Dirty' status for transaction rollback

  // Initialize items as truant
  await wTruant_ItsDeliv(aConn, aIDProducer);

  for (const oIt of aItsDeliv) {
    if (oIt.QtyDeliv !== undefined) {
      if (!(await wDeliv_ItPriceFix(aConn, oIt.IDItDeliv, oIt.QtyDeliv)))
        return { MsgFail: "Dirty" };
    }
    // The form system produces 'null' if the field was left blank. The page
    // does not allow quantity fields to be blank:
    else if (oIt.WgtPer !== undefined) {
      if (!(await wDeliv_ItPriceVar(aConn, oIt.IDItDeliv, oIt.WgtPer))) return { MsgFail: "Dirty" };
    } else throw Error("CheckIn wExec: Item delivery data not set");
  }

  // Update cart items
  // ----------------
  // Process out-of-stock items based on truancy:
  // 1. Items with notes: Updated in bulk (shopper already assigned)
  // 2. Non-note items: Allocated to earlier shoppers first
  // Note: ItCart modifications unlikely at this stage

  // Initialize as truant
  await wTruant_ItsCart(aConn, aIDProducer);
  await wUpd_ItsCartNote(aConn, aIDProducer);

  const oItsDeliv = await wItsDelivNoNote(aConn, aIDProducer);

  for (const oItDeliv of oItsDeliv) {
    let oQtyAvail = oItDeliv.QtyDeliv;
    const oItsProm = await wLock_ItsPromNoNote(aConn, oItDeliv.IDVty);

    for (const oItProm of oItsProm) {
      const oQtyAlloc = Math.min(oItProm.QtyProm, oQtyAvail);
      const oQtyTruant = oItProm.QtyProm - oQtyAlloc;
      await wUpd_ItCart(aConn, oItProm.IDItCart, oQtyAlloc, oQtyTruant);
      oQtyAvail -= oQtyAlloc;
    }
  }

  // Generate invoice
  // ---------------
  // Note: Generated files persist even if transaction rolls back
  // Unique filenames prevent overwriting on regeneration

  const oProducer = await wProducerFromID(aIDProducer, aConn);
  const oIDInvc = await wCreate(aConn, oCycStApp, oProducer);

  return { IDInvc: oIDInvc };
}

async function wTruant_ItsDeliv(aConn, aIDProducer) {
  const oSQL = `UPDATE ItDeliv
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		SET WgtPer = NULL, QtyDeliv = 0, QtyTruant = QtyProm,
			SaleNom = 0, FeeCoop = 0
		WHERE IDProducer = :IDProducer`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  await aConn.wExecPrep(oSQL, oParams);
}

/** Marks all of the specified producer's items 'truant' in ItCart. */
async function wTruant_ItsCart(aConn, aIDProducer) {
  const oSQL = `UPDATE ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		SET QtyDeliv = 0, QtyTruant = QtyProm
		WHERE IDProducer = :IDProducer`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  await aConn.wExecPrep(oSQL, oParams);
}

/** Returns the promised quantity and price of the specified delivery item. */
async function wItDelivProm(aConn, aIDItDeliv) {
  const oSQL = `SELECT ItDeliv.QtyProm, Vty.WgtMin, Vty.WgtMax, Vty.PriceNomWeb
		FROM ItDeliv
		JOIN Vty USING (IDVty)
		WHERE IDItDeliv = :IDItDeliv`;
  const oParams = {
    IDItDeliv: aIDItDeliv,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0] : null;
}

/** Sets the specified fixed-price item's quantities and sale data in ItDeliv.
 *  Returns 'false' if no row was updated, which indicates that ItDeliv was
 *  updated while the Check-in form was open. */
async function wDeliv_ItPriceFix(aConn, aIDItDeliv, aQtyDeliv) {
  const oItDelivProm = await wItDelivProm(aConn, aIDItDeliv);
  if (!oItDelivProm || oItDelivProm.QtyProm < aQtyDeliv) return false;

  const oSaleNom = oItDelivProm.PriceNomWeb * aQtyDeliv;

  //check if productID is set to exclude producer fee
  const feeCheck = await getProductRowFromIDItDeliv(aIDItDeliv);
  let oFeeCoop;
  if (!feeCheck[0].CkExcludeProducerFee) {
    //if the product is not set to exclude fees (almost all of them should go here)
    oFeeCoop = round(oSaleNom * Site.FracFeeCoopProducer, CtDigitCurrAcct);
  } else {
    //if it is set to exclude producer fees
    oFeeCoop = round(0.0, CtDigitCurrAcct);
  }

  // New IDItDeliv values are generated when ItDeliv is updated, so nothing will
  // happen if such an update was processed before this check-in:
  const oSQL = `UPDATE ItDeliv
		SET QtyDeliv = :QtyDeliv, QtyTruant = (QtyProm - :QtyDeliv),
			SaleNom = :SaleNom, FeeCoop = :FeeCoop
		WHERE IDItDeliv = :IDItDeliv`;
  const oParams = {
    IDItDeliv: aIDItDeliv,
    QtyDeliv: aQtyDeliv,
    SaleNom: oSaleNom,
    FeeCoop: oFeeCoop,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.affectedRows === 1;
}

/** Sets the specified variable-price item's quantities and sale data in
 *  ItDeliv. Returns 'false' if no row was updated, which indicates that ItDeliv
 *  was updated while the Check-in form was open. */
async function wDeliv_ItPriceVar(aConn, aIDItDeliv, aWgtPer) {
  const oItDelivProm = await wItDelivProm(aConn, aIDItDeliv);
  if (!oItDelivProm || oItDelivProm.QtyProm !== 1) return false;

  const oSaleNom = oItDelivProm.PriceNomWeb * (aWgtPer || 0);
  const oFeeCoop = round(oSaleNom * Site.FracFeeCoopProducer, CtDigitCurrAcct);
  // if ProductID is set to not charge the procuder fee, reset oFeeCoop to _.round((oSaleNom), gUtil.CtDigitCurrAcct);

  // New IDItDeliv values are generated when ItDeliv is updated, so nothing will
  // happen if such an update was processed before this check-in:
  const oSQL = aWgtPer
    ? `UPDATE ItDeliv
			SET WgtPer = :WgtPer, QtyDeliv = 1, QtyTruant = 0,
				SaleNom = :SaleNom, FeeCoop = :FeeCoop
			WHERE IDItDeliv = :IDItDeliv`
    : `UPDATE ItDeliv
			SET WgtPer = NULL, QtyDeliv = 0, QtyTruant = 1,
				SaleNom = :SaleNom, FeeCoop = :FeeCoop
			WHERE IDItDeliv = :IDItDeliv`;
  const oParams = {
    IDItDeliv: aIDItDeliv,
    WgtPer: aWgtPer,
    SaleNom: oSaleNom,
    FeeCoop: oFeeCoop,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.affectedRows === 1;
}

/** Uses ItDeliv to update the truant and delivered quantities of note-bearing
 *  items in ItCart, for the specified producer. */
async function wUpd_ItsCartNote(aConn, aIDProducer) {
  // IDItCart is one-to-one with IDVty within a given cart:
  const oSQL = `UPDATE ItCart
		JOIN (
			SELECT ItDeliv.IDItCart,
				SUM(ItDeliv.QtyDeliv) AS QtyDeliv, SUM(ItDeliv.QtyTruant) AS QtyTruant
			FROM ItDeliv
			JOIN StApp USING (IDCyc)
			JOIN Vty USING (IDVty)
			JOIN Product USING (IDProduct)
			WHERE (ItDeliv.IDItCart IS NOT NULL)
				AND (Product.IDProducer = :IDProducer)
			GROUP BY ItDeliv.IDItCart
		) AS zItsDeliv USING (IDItCart)
		SET ItCart.QtyDeliv = zItsDeliv.QtyDeliv,
			ItCart.QtyTruant = zItsDeliv.QtyTruant`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  await aConn.wExecPrep(oSQL, oParams);
}

/** Returns the sum of the specified producer's ItDeliv delivery quantities,
 *  grouped by variety, excepting items with notes. */
async function wItsDelivNoNote(aConn, aIDProducer) {
  // After excluding items with notes, there should be only one line per variety
  // in a given delivery:
  const oSQL = `SELECT ItDeliv.IDVty, SUM(ItDeliv.QtyDeliv) AS QtyDeliv
		FROM ItDeliv
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		WHERE ItDeliv.IDItCart IS NULL
			AND Product.IDProducer = :IDProducer
		GROUP BY ItDeliv.IDVty`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Returns all ItCart items for the specified variety, with promised
 *  quantities, except those with notes, in the order they were added to the
 *  cart. */
async function wLock_ItsPromNoNote(aConn, aIDVty) {
  const oSQL = `SELECT ItCart.IDItCart, ItCart.QtyProm
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE (ItCart.NoteShop IS NULL)
			AND (ItCart.IDVty = :IDVty)
		ORDER BY ItCart.WhenCreate
		FOR UPDATE`;
  const oParams = {
    IDVty: aIDVty,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Updates the delivery and truant quantities of the specified ItCart item. */
async function wUpd_ItCart(aConn, aIDItCart, aQtyDeliv, aQtyTruant) {
  const oSQL = `UPDATE ItCart
		SET QtyDeliv = :QtyDeliv, QtyTruant = :QtyTruant
		WHERE IDItCart = :IDItCart`;
  const oParams = {
    IDItCart: aIDItCart,
    QtyDeliv: aQtyDeliv,
    QtyTruant: aQtyTruant,
  };
  await aConn.wExecPrep(oSQL, oParams);
}
