// member-admin.js
// ---------------
// Member Admin page controllers

import { Conn } from "../../Db.js";
import { PathQuery, NamesParamMemb } from "../../Search.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // Would be much faster to consolidate these queries: [OPTIMIZE]
  aResp.locals.trialMembersCount = await trialMembersCount();
  aResp.locals.CtMembPend = await wCtMembPend();
  aResp.locals.CtEBTPend = await wCtEBTPend();
  aResp.locals.CtVolunPend = await wCtVolunPend();
  aResp.locals.CtMembWithItsCart = await wCtMembWithItsCart();
  aResp.locals.CtMembDelivHomeNoDist = await wCtMembDelivHomeNoDist();
  aResp.locals.CtMembBalPos = await wCtMembBalPos();
  aResp.locals.CtMembBalNeg = await wCtMembBalNeg();
  aResp.locals.CtMembEBT = await wCtMembEBT();
  aResp.locals.CtMembProducer = await wCtMembProducer();
  aResp.locals.CtMembStaff = await wCtMembStaff();
  aResp.locals.CtMembWholesale = await wCtMembWholesale();

  aResp.locals.Title = `${CoopParams.CoopNameShort} member admin`;
  aResp.render("MembAdmin/member-admin");
}

export function HandPost(aReq, aResp) {
  // It doesn't seem useful to validate search parameters. In fact, if invalid
  // data finds its way into the database, we will want to be able to select it
  // here.

  const oPath = PathQuery("/member-search-results", aReq.body, NamesParamMemb);
  aResp.redirect(303, oPath);
}

async function wCtMembPend() {
  const oSQL = `SELECT COUNT(*) AS Ct FROM Memb WHERE CdRegMemb = 'Pend' AND CyclesUsed = 2`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wCtMembPend: Cannot get count");
  return oRows[0].Ct;
}

async function trialMembersCount() {
  const oSQL = `SELECT COUNT(*) AS Ct FROM Memb WHERE CyclesUsed < 2`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("trialMembersCount: Cannot get count");
  return oRows[0].Ct;
}

async function wCtEBTPend() {
  const oSQL = `SELECT COUNT(*) AS Ct FROM Memb WHERE CdRegEBT = 'Pend'`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wCtEBTPend: Cannot get count");
  return oRows[0].Ct;
}

async function wCtVolunPend() {
  const oSQL = `SELECT COUNT(*) AS Ct FROM Memb WHERE CdRegVolun = 'Pend'`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wCtVolunPend: Cannot get count");
  return oRows[0].Ct;
}

async function wCtMembWithItsCart() {
  const oSQL = `SELECT COUNT(DISTINCT IDMemb) AS Ct
		FROM Cart
		JOIN ItCart USING (IDCart)
		JOIN StApp USING (IDCyc)`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wCtMembWithItsCart: Cannot get count");
  return oRows[0].Ct;
}

async function wCtMembDelivHomeNoDist() {
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM Memb
		JOIN Loc ON (Loc.CdLoc = Memb.CdLocLast)
		WHERE (Loc.CdTypeLoc = 'Deliv') AND (DistDeliv IS NULL)`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wCtMembDelivHomeNoDist: Cannot get count");
  return oRows[0].Ct;
}

async function wCtMembBalPos() {
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM Memb
		JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE (BalMoney + BalEBT) > 0`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wCtMembBalPos: Cannot get count");
  return oRows[0].Ct;
}

async function wCtMembBalNeg() {
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM Memb
		JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE (BalMoney + BalEBT) < 0`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wCtMembBalNeg: Cannot get count");
  return oRows[0].Ct;
}

async function wCtMembEBT() {
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM Memb
		WHERE CdRegEBT = 'Approv'`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wwCtMembEBT: Cannot get count");
  return oRows[0].Ct;
}

async function wCtMembProducer() {
  const oSQL = `SELECT COUNT(*) AS Ct FROM Producer`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wCtMembProducer: Cannot get count");
  return oRows[0].Ct;
}

async function wCtMembStaff() {
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM Memb
		WHERE CdStaff != 'NotStaff'`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wwCtMembStaff: Cannot get count");
  return oRows[0].Ct;
}

async function wCtMembWholesale() {
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM Memb
		WHERE CdRegWholesale = 'Approv'`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (!oRows.length) throw Error("wwCtMembWholesale: Cannot get count");
  return oRows[0].Ct;
}
