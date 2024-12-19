// Cred.js
// =======
// Member Authorization and Profile Data
//
// This module manages member authorization and profile data, including:
// 1. User authentication properties
// 2. Member profile information
// 3. Producer-specific details
// 4. Access control attributes
//
// Note: The scope of this module extends beyond basic credentials,
// encompassing member profiles and authorization states.
// Future enhancement: Consider renaming for clarity.

import { Conn } from "./Db.js";
import { Staff } from "./Mix.js";

/** SQL query to retrieve member profile and authorization data.
 *  Includes data required for:
 *  - Header and navigation display
 *  - Authorization checks
 *  - Member profile information
 *  - Producer details
 *  - Account balances
 */
const SQLSelCred = `SELECT Memb.IDMemb, NameLogin, HashPass, HashPassLeg, CkLock,
		CdRegMemb, CdRegEBT, CdRegVolun, Name1First, Name1Last,
		Memb.City AS CityMemb, Memb.St AS StMemb,
		CkShowProducer, CdStaff, CdLocLast, DistDeliv,
		Producer.IDProducer, Producer.CdProducer, Producer.CdRegProducer,
		Producer.CkListProducer, Producer.NameBus AS NameBusProducer,
		Producer.CdRegWholesale,
		IFNULL(zTransact.BalMoney, 0) AS BalMoney,
		IFNULL(zTransact.BalEBT, 0) AS BalEBT
	FROM Memb
	LEFT JOIN (
		SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
		FROM Transact
		GROUP BY Transact.IDMemb
	) AS zTransact ON (zTransact.IDMemb = Memb.IDMemb)
	LEFT JOIN Producer ON (Producer.IDMemb = Memb.IDMemb)`;

/** Retrieves member profile and authorization data by member ID.
 *  @param {number} aIDMemb - Member ID to look up
 *  @returns {Object|null} Member data object if found, null otherwise
 */
export async function wCredFromIDMemb(aIDMemb) {
  const oSQL = `${SQLSelCred}\nWHERE Memb.IDMemb = ?`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, [aIDMemb]);
  if (!oRows.length) return null;
  return oRows.length ? Staff(oRows[0]) : null;
}

/** Retrieves member profile and authorization data by producer ID.
 *  @param {number} aIDProducer - Producer ID to look up
 *  @returns {Object|null} Member data object if found, null otherwise
 */
export async function wCredFromIDProducer(aIDProducer) {
  const oSQL = `${SQLSelCred}\nWHERE Producer.IDProducer = ?`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, [aIDProducer]);
  if (!oRows.length) return null;
  return oRows.length ? Staff(oRows[0]) : null;
}

/** Retrieves member profile and authorization data by login name.
 *  @param {string} aNameLogin - Login name to look up
 *  @returns {Object|null} Member data object if found, null otherwise
 */
export async function wCredFromNameLogin(aNameLogin) {
  const oSQL = `${SQLSelCred} WHERE NameLogin = ?`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, [aNameLogin]);
  return oRows.length ? Staff(oRows[0]) : null;
}
