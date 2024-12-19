// Invt.js
// -------
// Inventory management functions

import { wSend_MsgItCart } from "./Flash.js";

/** Synchronizes variety inventory with cart promises
 *  @param {Connection} aConn - Database connection with active transaction
 *  @param {number} aIDVty - Variety identifier
 *  @returns {boolean} True if promised quantities were modified
 *  @throws {Error} If quantities cannot be retrieved
 *  @note Prerequisites:
 *  - Must be called before delivery window closes
 *  - Producer check-in status must be verified
 *  - Transaction rollback required if producer is checked in
 *  @note Side effects:
 *  - May modify ItDeliv and WgtLblOrdWeb tables if delivery window is open
 *  - Updates cart item status (OOS/restock) based on availability
 */
export async function wLockBal_QtyProm(aConn, aIDVty) {
  // Set to 'true' if any promised quantity changed:
  let oCkChgProm = false;
  // One cart will be OOS'ed or re-stocked per iteration, if such is required.
  // This is the simplest implementation, not the fastest:
  while (true) {
    // Get offer and total promised quantities
    // ---------------------------------------

    const oSQLQtys = `SELECT Vty.QtyOffer, IFNULL(zItCartVty.QtyProm, 0) AS QtyProm
			FROM Vty
			LEFT JOIN (
				SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
				FROM Vty
				JOIN ItCart USING (IDVty)
				JOIN Cart USING (IDCart)
				JOIN StApp USING (IDCyc)
				GROUP BY Vty.IDVty
				FOR UPDATE
			) AS zItCartVty USING (IDVty)
			WHERE IDVty = ?
			FOR UPDATE`;
    const [oRowsQtys] = await aConn.wExecPrep(oSQLQtys, [aIDVty]);
    if (oRowsQtys.length < 1) throw Error("Invt wBal_QtyProm: Cannot get quantities");

    const oQtyAvail = oRowsQtys[0].QtyOffer - oRowsQtys[0].QtyProm;

    // Items must be OOS'd
    // -------------------

    if (oQtyAvail < 0) {
      // A quantity must have been promised, or the available quantity would be
      // negative:
      const oIt = await wLock_ItCartPromLast(aConn, aIDVty);
      // The available quantity is negative:
      const oQtyPromNew = Math.max(oIt.QtyProm + oQtyAvail, 0);
      // The promised quantity has decreased:
      const oQtyWithdrNew = oIt.QtyWithdr + (oIt.QtyProm - oQtyPromNew);

      await wUpd_QtysItCart(aConn, oIt.IDItCart, oQtyPromNew, oQtyWithdrNew);
      oCkChgProm = true;

      const oMsg = oQtyPromNew
        ? "Your order of <strong>$NameProductVty</strong> is partially out of stock."
        : "Your order of <strong>$NameProductVty</strong> is out of stock.";
      // No need to await:
      wSend_MsgItCart(oIt.IDItCart, "danger", "Sorry!", oMsg);
      continue;
    }

    // Items can be re-stocked
    // -----------------------

    if (oQtyAvail > 0) {
      const oIt = await wLock_ItCartWithdrFirst(aConn, aIDVty);
      // Could be no items have been OOS'd:
      if (!oIt) break;

      // The available quantity is positive:
      const oQtyWithdrNew = Math.max(oIt.QtyWithdr - oQtyAvail, 0);
      // The withdrawn quantity has decreased:
      const oQtyPromNew = oIt.QtyProm + (oIt.QtyWithdr - oQtyWithdrNew);

      await wUpd_QtysItCart(aConn, oIt.IDItCart, oQtyPromNew, oQtyWithdrNew);
      oCkChgProm = true;

      const oMsg = oQtyWithdrNew
        ? "Your order of <strong>$NameProductVty</strong> has been partially re-stocked."
        : "Your order of <strong>$NameProductVty</strong> has been re-stocked.";
      // No need to await:
      wSend_MsgItCart(oIt.IDItCart, "success", "Good news!", oMsg);
      continue;
    }

    // The promised quantity must be equal to the offer quantity.
    break;
  }
  return oCkChgProm;
}

/** Locks and returns the newest cart item that promises the specified variety. */
async function wLock_ItCartPromLast(aConn, aIDVty) {
  const oSQL = `SELECT ItCart.IDItCart, ItCart.QtyProm, ItCart.QtyWithdr
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE (ItCart.IDVty = ?) AND (ItCart.QtyProm > 0)
		ORDER BY ItCart.WhenCreate DESC
		LIMIT 1
		FOR UPDATE`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDVty]);
  if (oRows.length < 1) throw Error("Invt wItCartPromLast: Cannot get promised cart item");
  return oRows[0];
}

/** Returns the oldest cart item that has withdrawn the specified variety, or
 *  'null' if it has not been withdrawn. */
async function wLock_ItCartWithdrFirst(aConn, aIDVty) {
  const oSQL = `SELECT ItCart.IDItCart, ItCart.QtyProm, ItCart.QtyWithdr
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE (ItCart.IDVty = ?) AND (ItCart.QtyWithdr > 0)
		ORDER BY ItCart.WhenCreate
		LIMIT 1
		FOR UPDATE`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDVty]);
  return oRows.length < 1 ? null : oRows[0];
}

/** Sets the promised and withdrawn quantities of the specified cart item. */
async function wUpd_QtysItCart(aConn, aIDItCart, aQtyProm, aQtyWithdr) {
  const oSQL = `UPDATE ItCart
		SET QtyProm = :QtyProm, QtyWithdr = :QtyWithdr
		WHERE IDItCart = :IDItCart`;
  const oData = {
    IDItCart: aIDItCart,
    QtyProm: aQtyProm,
    QtyWithdr: aQtyWithdr,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oData);
  if (oRows.affectedRows < 1) throw Error("Invt wUpd_QtysItCart: Cannot update cart item");
}

/** Replaces all ItDeliv records in this cycle. */
export async function wLockFill_ItDeliv(aConn) {
  console.log("~ Filling delivery item table...");

  // Get cart items
  // --------------

  const oSQLIts = `SELECT IDCyc, IDVty, IDItCart, SUM(QtyProm) AS QtyProm, CkPriceVar
		FROM (
			SELECT IF(ItCart.NoteShop IS NULL, NULL, ItCart.IDItCart) AS IDItCart,
				ItCart.IDVty, ItCart.QtyProm,
				IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
				IDCyc
			FROM ItCart
			JOIN Vty USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp USING (IDCyc)
			FOR UPDATE
		) AS zItsCart
		GROUP BY IDCyc, IDVty, IDItCart, CkPriceVar
		ORDER BY IDCyc, IDVty, IDItCart
		FOR UPDATE`;
  const [oIts] = await aConn.wExecPrep(oSQLIts);

  // Replace delivery items
  // ----------------------

  const oSQLDel = `DELETE FROM ItDeliv
		WHERE IDCyc IN (SELECT IDCyc FROM StApp)`;
  await aConn.wExecPrep(oSQLDel);

  await wAdd_ItsDeliv(aConn, oIts);
}

/** Replaces ItDeliv records of the specified variety, in this cycle. */
export async function wLockUpd_ItDeliv(aConn, aIDVty) {
  // Get cart items
  // --------------

  const oSQLIts = `SELECT IDCyc, IDVty, IDItCart, SUM(QtyProm) AS QtyProm, CkPriceVar
		FROM (
			SELECT IF(ItCart.NoteShop IS NULL, NULL, ItCart.IDItCart) AS IDItCart,
				ItCart.IDVty, ItCart.QtyProm,
				IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
				IDCyc
			FROM ItCart
			JOIN Vty USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp USING (IDCyc)
			WHERE (Vty.IDVty = ?)
			FOR UPDATE
		) AS zItsCart
		GROUP BY IDCyc, IDVty, IDItCart, CkPriceVar
		HAVING QtyProm > 0
		ORDER BY IDCyc, IDVty, IDItCart
		FOR UPDATE`;
  const [oIts] = await aConn.wExecPrep(oSQLIts, [aIDVty]);

  // Replace delivery item records
  // -----------------------------

  const oSQLDel = `DELETE FROM ItDeliv
		WHERE IDCyc IN (SELECT IDCyc FROM StApp)
			AND IDVty = ?`;
  await aConn.wExecPrep(oSQLDel, [aIDVty]);

  await wAdd_ItsDeliv(aConn, oIts);
}

/** Adds the specified items to ItDeliv, splitting variable-price items into
 *  unit-quantity rows. */
async function wAdd_ItsDeliv(aConn, aIts) {
  for (const oIt of aIts) {
    const oParamsIns = {
      IDCyc: oIt.IDCyc,
      IDVty: oIt.IDVty,
      IDItCart: oIt.IDItCart,
    };

    // Split variable-price quantities:
    if (oIt.CkPriceVar) {
      const oSQLIns = `INSERT INTO ItDeliv(IDCyc, IDVty, IDItCart, QtyProm)
				VALUES(:IDCyc, :IDVty, :IDItCart, 1)`;
      for (let oiQty = 0; oiQty < oIt.QtyProm; ++oiQty) {
        const [oOutIns] = await aConn.wExecPrep(oSQLIns, oParamsIns);
        if (oOutIns.affectedRows < 1) throw Error("EvtCyc wFill_ItDeliv: Cannot insert item");
      }
    }
    // Keep fixed-price quantities together:
    else {
      const oSQLIns = `INSERT INTO ItDeliv(IDCyc, IDVty, IDItCart, QtyProm)
				VALUES(:IDCyc, :IDVty, :IDItCart, :QtyProm)`;
      oParamsIns.QtyProm = oIt.QtyProm;
      const [oOutIns] = await aConn.wExecPrep(oSQLIns, oParamsIns);
      if (oOutIns.affectedRows < 1) throw Error("EvtCyc wFill_ItDeliv: Cannot insert item");
    }
  }
}

/** Replaces all WgtLblOrdWeb records. */
export async function wFill_WgtLblOrdWeb(aConn) {
  console.log("~ Filling web order label weight table...");

  // Get cart items
  // --------------

  // The cart item IDs are not meaningful when there are no notes, but that will
  // be handled by wAdd_WgtsLblOrdWeb:
  const oSQLIts = `SELECT ItCart.IDItCart, ItCart.IDVty, ItCart.NoteShop, ItCart.QtyProm
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE (Vty.Size IS NULL)
			AND (Vty.CkInvtMgd IS FALSE)
		ORDER BY ItCart.IDVty, ItCart.NoteShop, Cart.IDCart`;
  const [oIts] = await aConn.wExecPrep(oSQLIts);

  // Replace weight records
  // ----------------------

  await aConn.wExecPrep("DELETE FROM WgtLblOrdWeb");

  await wAdd_WgtsLblOrdWeb(aConn, oIts);
}

/** Replaces WgtLblOrdWeb records of the specified variety. */
export async function wLockUpd_WgtLblOrdWeb(aConn, aIDVty) {
  // Get cart items
  // --------------

  const oSQLIts = `SELECT ItCart.IDItCart, ItCart.IDVty, ItCart.NoteShop, ItCart.QtyProm
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE (Vty.Size IS NULL)
			AND (Vty.CkInvtMgd IS FALSE)
			AND (Vty.IDVty = ?)
		ORDER BY ItCart.NoteShop, ItCart.IDItCart, Cart.IDCart
		FOR SHARE`;
  const [oIts] = await aConn.wExecPrep(oSQLIts, [aIDVty]);

  // Replace weight records
  // ----------------------

  const oSQLDel = `DELETE FROM WgtLblOrdWeb
		WHERE IDVty = ?`;
  await aConn.wExecPrep(oSQLDel, [aIDVty]);

  await wAdd_WgtsLblOrdWeb(aConn, oIts);
}

async function wAdd_WgtsLblOrdWeb(aConn, aIts) {
  for (const oIt of aIts) {
    // Weights are not associated with specific shoppers until checkout time,
    // unless their items also bear notes:
    if (oIt.NoteShop === null) oIt.IDItCart = null;

    for (let oQty = 0; oQty < oIt.QtyProm; ++oQty) {
      // Doesn't seem like this table needs NoteShop anymore:
      const oSQL = `INSERT INTO WgtLblOrdWeb (IDVty, NoteShop, IDItCart)
				VALUES (:IDVty, :NoteShop, :IDItCart)`;
      const oParams = {
        IDVty: oIt.IDVty,
        NoteShop: oIt.NoteShop,
        IDItCart: oIt.IDItCart,
      };
      const [oOut] = await aConn.wExecPrep(oSQL, oParams);
      if (oOut.affectedRows < 1) throw Error("Invt wAdd_WgtsLblOrdWeb: Cannot insert weight");
    }
  }
}
