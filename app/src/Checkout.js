// Checkout.js
// ===========
// Shopper checkout operations

import { wCreate } from "./InvcShopWeb.js";
import { wLock_CycStApp, wLock_CartFromIDMemb, wMembFromID, wAdd_Transact } from "./Db.js";
import { Add_CkExcludeConsumerFee, TtlsCart, CkEqCurrAcct } from "./Util.js";

import _ from "lodash";
const { cloneDeep } = _;

/** Process member checkout with pickup quantities.
 *  @param {Object} aConn - Database connection
 *  @param {number} aIDMemb - Member ID
 *  @param {Array} aItsPickup - Pickup items with IDItPickup and QtySold/WgtPer
 *  @param {Object} aVtysByID - Variety data by ID
 *  @param {string} aCdStatCart - Cart status code
 *  @returns {Object} Contains IDInvc on success or MsgFail on validation error
 */
export async function wExec(aConn, aIDMemb, aItsPickup, aVtysByID, aCdStatCart) {
  // Clone variety data to track reject quantities during updates
  const oDataVtyByID = cloneDeep(aVtysByID);

  // Validate cycle phase
  // ------------------
  const oCycStApp = await wLock_CycStApp(aConn);
  if (oCycStApp.CdPhaseCyc !== "StartPickup") return { MsgFail: "OutWinPickup" };

  // Validate cart status
  // ------------------
  const oCart = await wLock_CartFromIDMemb(aConn, aIDMemb);
  if (!oCart) return { MsgFail: "NoCart" };
  if (oCart.CdStatCart !== "Pend") return { MsgFail: "DoneCart" };

  // Process pickup records
  // --------------------
  // Implementation note: Handling of variable-price items requires:
  // 1. Individual unit quantity tracking
  // 2. Separate lost/rejected quantity management

  const oItsByIDItPickup = await wItsByIDItPickup(aConn, aIDMemb);

  // Initialize items as lost
  await wLose_ItsPickup(aConn, aIDMemb);

  for (const oIt of aItsPickup) {
    const oDataIt = oItsByIDItPickup[oIt.IDItPickup];
    if (!oDataIt) throw Error("Checkout wExec: Cannot get item data");

    const oDataVty = oDataVtyByID[oDataIt.IDVty];
    if (!oDataVty) throw Error("Checkout wExec: Cannot get variety data");

    if (oDataIt.CkPriceVar) {
      // Update variable-price item quantities
      if (!(await wSell_ItPriceVar(aConn, oIt.IDItPickup, oIt.WgtPer, oDataVty)))
        throw Error("Checkout wExec: Cannot update variable-price pickup item");
    } else {
      // Update fixed-price item quantities
      if (!(await wSell_ItPriceFix(aConn, oIt.IDItPickup, oIt.QtySold, oDataVty)))
        throw Error("Checkout wExec: Cannot update fixed-price pickup item");
    }
  }

  // Process cart records
  // -------------------
  // Implementation note: Cart records are updated based on pickup quantities

  // Initialize cart items as lost
  await wLose_ItsCart(aConn, aIDMemb);

  // Retrieve checkout data
  const oItsCheckout = await wItsCheckout(aConn, oCart.IDCart);
  const oItsCheckoutExtended = await Add_CkExcludeConsumerFee(oItsCheckout);
  //("oItsCheckout: ", oItsCheckoutExtended);
  const oMemb = await wMembFromID(aIDMemb, aConn);
  const oCkRegEBT = oMemb.CdRegEBT === "Approv";
  const oCkRegWholesale = oMemb.CdRegWholesale === "Approv";
  const oDataCart = TtlsCart(
    oItsCheckoutExtended,
    "QtySold",
    "PriceNomWeb",
    oCkRegEBT,
    oCart.CdLoc,
    oMemb.DistDeliv,
    oCkRegWholesale,
  );

  // Update cart records
  const oTasks = oDataCart.Its.map(o => wUpd_ItCart(aConn, o));
  await Promise.all(oTasks);

  // Update cart status
  // -----------------
  await wUpd_Cart(aConn, aIDMemb, aCdStatCart);

  // Generate invoice file and record
  // --------------------------------
  // Implementation note: Invoice generation is based on cart data

  const oDataInvc = await wCreate(aConn, oCycStApp, oMemb, oCart, aCdStatCart);

  // Validate invoice totals
  const oCkTtls =
    CkEqCurrAcct(oDataInvc.TtlMoney, oDataCart.TtlMoney) &&
    CkEqCurrAcct(oDataInvc.TtlEBT, oDataCart.TtlEBT) &&
    CkEqCurrAcct(oDataInvc.Ttl, oDataCart.Ttl);
  if (!oCkTtls) return { MsgFail: "MismatchTtl" };

  // Post invoice transaction
  // ------------------------
  // Implementation note: Transaction is posted based on invoice data

  const oOptsTransact = {
    IDInvc: oDataInvc.IDInvc,
    FeeCoop: oDataInvc.FeeCoopShop,
    TaxSale: oDataInvc.TaxSale,
  };
  // The transaction isn't directly created by the user, so the 'create' user
  // should be left null:
  await wAdd_Transact(
    aIDMemb,
    "ChargeInvcShopWeb",
    oDataInvc.TtlMoney,
    oDataInvc.TtlEBT,
    null,
    oOptsTransact,
    aConn,
  );

  return { IDInvc: oDataInvc.IDInvc };
}

async function wItsByIDItPickup(aConn, aIDMemb) {
  const oSQL = `SELECT ItPickup.IDItPickup,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar
		FROM ItPickup
		JOIN ItCart USING (IDItCart)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		WHERE Cart.IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);

  // Convert array to object
  // -----------------------

  const oIts = {};
  // We could delete the ID from the object, but I suppose there is no need:
  for (const oRow of oRows) oIts[oRow.IDItPickup] = oRow;
  return oIts;
}

async function wLose_ItsPickup(aConn, aIDMemb) {
  const oSQL = `UPDATE ItPickup
		JOIN ItCart USING (IDItCart)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		SET ItPickup.WgtPer = NULL,
			ItPickup.QtyLost = ItPickup.QtyDeliv,
			ItPickup.QtyReject = 0,
			ItPickup.QtySold = 0
		WHERE IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  await aConn.wExecPrep(oSQL, oParams);
}

/** Sets the quantities of the specified variable-price item line in ItPickup.
 *  @param {Object} aConn - Database connection
 *  @param {number} aIDItPickup - Pickup item ID
 *  @param {number} aWgtPer - Weight percentage
 *  @param {Object} aDataVty - Variety data with QtyReject counter
 *  @returns {boolean} True if update successful, false otherwise
 *
 *  Note: aDataVty is used to track remaining reject quantities across multiple
 *  function calls. Consider implementing a dedicated state management solution
 *  in future iterations.
 */
async function wSell_ItPriceVar(aConn, aIDItPickup, aWgtPer, aDataVty) {
  const oSQL = `UPDATE ItPickup
		SET WgtPer = :WgtPer,
			QtyLost = :QtyLost, QtyReject = :QtyReject, QtySold = :QtySold
		WHERE IDItPickup = :IDItPickup`;

  const oParams = {
    IDItPickup: aIDItPickup,
    WgtPer: aWgtPer,
    QtyLost: 0,
    QtyReject: 0,
    QtySold: 0,
  };

  if (aWgtPer) oParams.QtySold = 1;
  else if (aDataVty.QtyReject) {
    oParams.QtyReject = 1;
    --aDataVty.QtyReject;
  } else oParams.QtyLost = 1;

  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.affectedRows === 1;
}

/** Sets the quantities of the specified fixed-price item line in ItPickup.
 *  @param {Object} aConn - Database connection
 *  @param {number} aIDItPickup - Pickup item ID
 *  @param {number} aQtySold - Quantity sold
 *  @param {Object} aDataVty - Variety data with QtyReject counter
 *  @returns {boolean} True if update successful, false otherwise
 *
 *  Implementation note: Delivered quantity is retrieved from database to ensure
 *  data consistency and validation.
 */
async function wSell_ItPriceFix(aConn, aIDItPickup, aQtySold, aDataVty) {
  // Retrieve delivered quantity for validation
  const oSQLSel = `SELECT QtyDeliv
		FROM ItPickup
		WHERE IDItPickup = :IDItPickup
		FOR UPDATE`;
  const oParamsSel = {
    IDItPickup: aIDItPickup,
  };
  const [oRowsSel] = await aConn.wExecPrep(oSQLSel, oParamsSel);

  if (!oRowsSel || aQtySold + aDataVty.QtyReject > oRowsSel[0].QtyDeliv) return false;

  const oSQLUpd = `UPDATE ItPickup
		SET QtyLost = (QtyDeliv - :QtyReject - :QtySold),
			QtyReject = :QtyReject,
			QtySold = :QtySold
		WHERE IDItPickup = :IDItPickup`;
  const oParamsUpd = {
    IDItPickup: aIDItPickup,
    QtyReject: aDataVty.QtyReject,
    QtySold: aQtySold,
  };
  // The variety won't be updated again, but for consistency:
  aDataVty.QtyReject = 0;

  const [oRowsUpd] = await aConn.wExecPrep(oSQLUpd, oParamsUpd);

  return oRowsUpd.affectedRows === 1;
}

async function wLose_ItsCart(aConn, aIDMemb) {
  const oSQL = `UPDATE ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		SET ItCart.QtyLost = ItCart.QtyDeliv,
			ItCart.QtyReject = 0, ItCart.QtySold = 0,
			ItCart.SaleNom = 0, ItCart.FeeCoop = 0, ItCart.FeeCoopForgiv = 0,
			ItCart.TaxSale = 0
		WHERE IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  await aConn.wExecPrep(oSQL, oParams);
}

/** Returns the checkout totals stored in ItPickup, grouped by IDItCart, with
 *  product and variety data that can be used to calculate sale values. */
async function wItsCheckout(aConn, aIDCart) {
  const oSQL = `SELECT SUM(ItPickup.WgtPer) AS WgtTtl,
			SUM(ItPickup.QtyLost) AS QtyLost,
			SUM(ItPickup.QtyReject) AS QtyReject,
			SUM(ItPickup.QtySold) AS QtySold,
			ItCart.IDItCart,
			Vty.IDVty, Vty.WgtMin, Vty.WgtMax, Vty.PriceNomWeb, Vty.CdVtyType,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Subcat.CkTaxSale, Subcat.CkEBT, Product.IDProduct,
			IFNULL(FeeCoopVty.FracFeeCoopWholesaleMemb, (SELECT FracFeeCoopWholesaleMemb FROM Site)) AS FracFeeCoopWholesaleMemb
		FROM ItPickup
		JOIN ItCart USING (IDItCart)
		JOIN Vty USING (IDVty)
		LEFT JOIN FeeCoopVty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Subcat USING (IDSubcat)
		WHERE ItCart.IDCart = :IDCart
		GROUP BY IDItCart`;
  const oParams = {
    IDCart: aIDCart,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Updates a single ItCart record. */
async function wUpd_ItCart(aConn, aItCart) {
  const oSQL = `UPDATE ItCart
		SET QtyLost = :QtyLost, QtyReject = :QtyReject, QtySold = :QtySold,
			SaleNom = :SaleNom, FeeCoop = :FeeCoop, FeeCoopForgiv = :FeeCoopForgiv,
			TaxSale = :TaxSale
		WHERE ItCart.IDItCart = :IDItCart`;
  const oParams = {
    IDItCart: aItCart.IDItCart,
    QtyLost: aItCart.QtyLost,
    QtyReject: aItCart.QtyReject,
    QtySold: aItCart.QtySold,
    SaleNom: aItCart.SaleNom,
    FeeCoop: aItCart.FeeCoopShop,
    FeeCoopForgiv: aItCart.FeeCoopShopForgiv,
    TaxSale: aItCart.TaxSale,
  };
  await aConn.wExecPrep(oSQL, oParams);
}

/** Advances the cart status for the specified member. */
async function wUpd_Cart(aConn, aIDMemb, aCdStatCart) {
  const oSQL = `UPDATE Cart
		JOIN StApp USING (IDCyc)
		SET CdStatCart = :CdStatCart
		WHERE Cart.IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
    CdStatCart: aCdStatCart,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  if (!oRows.affectedRows) throw Error("Checkout wUpd_Cart: Cannot update cart record");
}
