// distribution.js
// ---------------
// Distribution page controllers

import { wLocsSatelActiv, Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} distribution`;
  aResp.locals.LocsPickup = await wLocsPickup();
  aResp.locals.LocsPickupPend = await wLocsPickupPend();
  aResp.locals.LocsPickupDone = await wLocsPickupDone();
  aResp.locals.LocsSatel = await wLocsSatelActiv();
  aResp.render("Distrib/distribution");
}

/** Returns all locations with at least one cart. */
async function wLocsPickup() {
  const oSQL = `SELECT Loc.*
		FROM Loc
		WHERE CdLoc IN (
			SELECT Cart.CdLoc
			FROM Cart
			JOIN StApp USING (IDCyc)
		)
		ORDER BY NameLoc, CdLoc`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}

/** Returns all locations with at least one cart awaiting pickup. */
async function wLocsPickupPend() {
  const oSQL = `SELECT Loc.*
		FROM Loc
		WHERE CdLoc IN (
			SELECT Cart.CdLoc
			FROM Cart
			WHERE CdStatCart = 'Pend'
		)
		ORDER BY NameLoc, CdLoc`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}

/** Returns all active locations with no carts awaiting pickup. */
async function wLocsPickupDone() {
  const oSQL = `SELECT Loc.*
		FROM Loc
		WHERE (CkActiv IS TRUE)
			AND CdLoc NOT IN (
				SELECT Cart.CdLoc
				FROM Cart
				WHERE CdStatCart = 'Pend'
			)
		ORDER BY NameLoc, CdLoc`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}
