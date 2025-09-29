// Db.js
// -----
// Database utilities
//
// If a query parameter is specified in some SQL, but not defined in the data
// object, 'mysql2' will throw a 'Bind parameters must not contain undefined'
// exception from 'connection.js'. To improve error handling and debugging, it's
// essential to validate query parameters before execution.

import { wHash } from "./Pass.js";
import { Add_CkExcludeConsumerFee, SummCart } from "./Util.js";
import { Site } from "./Site.js";
import { Db } from "../Cfg.js";

import { createPool, escape } from "mysql2";
import _ from "lodash";

// -------------------
// Database connection
// ------------------
// When using mysql2 with time zones, there are a few considerations:
// 1. The database server uses UTC time zone
// 2. Local development and server environments may handle DST differently
// 3. This can affect date calculations, especially for future dates
//
// For more details on timezone handling in mysql2, see:
// https://github.com/sidorares/node-mysql2/pull/996
// https://github.com/sidorares/node-mysql2/issues/262
//
// The timezone property in the connection options specifies the database server's
// timezone. Our server uses UTC, so we set it to 'Z'.

const OptsPool = {
  ...Db,

  // The MySQL server uses UTC:
  timezone: "Z",
  namedPlaceholders: true,
  // What makes sense here?: [TO DO]
  connectionLimit: 10,
  decimalNumbers: true,
};

/** The 'mysql2' database connection pool, which also acts as a connection in
 *  that API. */

// Note: When using mysql2 with parameterized queries, all parameters must be defined.
// If a parameter is undefined, mysql2 will throw a 'Bind parameters must not contain undefined'
// exception. For improved error handling and debugging:
// 1. Always check that all parameters are defined before executing queries
// 2. Consider adding parameter validation in wrapper functions
// 3. Reference: https://github.com/sidorares/node-mysql2/issues/986

const PoolBase = createPool(OptsPool).promise();

export let FldsProduct = null;
export let FldsVty = null;
export async function wReady() {
  // Database metadata
  // -----------------

  async function owFldsTbl(aNameTbl) {
    const oSQL = `DESC ${aNameTbl}`;
    const [oRows] = await Conn.wExec(oSQL);
    return oRows.map(oRow => oRow.Field);
  }

  FldsProduct = await owFldsTbl("Product");
  FldsVty = await owFldsTbl("Vty");
}

// ------------------
// Database API
// ------------------
// The Conn object and the tConnTransact class wrap the 'mysql2' API.
// Originally, I called that API directly, but I had to work around the
// parameter type problem documented in wExecPrep_ConnBase, and I couldn't find
// a good way to insert that fix into 'mysql2' itself; replacing the 'query' and
// 'execute' functions in the default pool object was easy enough, but that did
// not work for connections returned by getConnection, and the 'mysql2' code is
// completely uncommented.
//
// In general, I am getting tired of 'mysql2', which seems to be barely
// maintained. These wrappers will allow it to be replaced, if they keep pissing
// me off. We can also use the wrappers to add proper query parameter validation
// (see above).

/** Uses a 'mysql2' connection to run a query without preparing it, then returns
 *  the result. */
async function wExec_ConnBase(aConnBase, aSQL, aParams) {
  return await aConnBase.query(aSQL, aParams);
}

/** Uses a 'mysql2' connection to prepare a query, then runs it and returns the
 *  result. */
async function wExecPrep_ConnBase(aConnBase, aSQL, aParams) {
  // This nonsense works around a problem that caused the product search query
  // to produce 'Incorrect arguments to mysqld_stmt_execute' errors. I had made
  // no changes to the code. Several developers in this 'mysql2' thread report
  // the same problem after upgrading MySQL:
  //
  //   https://github.com/sidorares/node-mysql2/issues/1239
  //
  // There is discussion here as well:
  //
  //   https://stackoverflow.com/questions/65543753/error-incorrect-arguments-to-mysqld-stmt-execute
  //
  // The current MySQL version is '8.0.23'. I'm not sure when that was
  // installed, but I first observed the problem a few hours after the managed
  // database upgrade window, so I have to assume that is what caused the
  // problem. Presumably any prepared query could be affected, though I have
  // seen it only in the product search.
  //
  // Anyway, as several developers reported, the problem can be avoided by
  // converting number parameters to strings:

  const oParamsFix = {};
  for (const oName in aParams) {
    const oVal = aParams[oName];
    // Seems safer not to change Date types, et cetera:
    oParamsFix[oName] = typeof oVal === "number" ? String(oVal) : oVal;
  }
  return await aConnBase.execute(aSQL, oParamsFix);

  // If the root problem is ever fixed, we can go back to:
  //
  //   return await aConnBase.execute(aSQL, aParams);
  //
}

export const Conn = {
  /** Runs a query without preparing it, then returns the result. */
  wExec: async function (aSQL, aParams) {
    return await wExec_ConnBase(PoolBase, aSQL, aParams);
  },

  /** Prepares a query, runs it, and then returns the result. */
  wExecPrep: async function (aSQL, aParams) {
    return await wExecPrep_ConnBase(PoolBase, aSQL, aParams);
  },
};

/** A database connection that can be used to process a transaction. Instances
 *  should be created with wConnNew. The connection must be explicitly closed
 *  with the Release method when you are done. */
class tConnTransact {
  /** Creates an instance from a 'mysql2' connection. */
  constructor(aConnBase) {
    this.cConnBase = aConnBase;
  }

  /** Starts a transaction, after setting the specified isolation level, if any.
   *  Subsequent transactions will revert to the default isolation level. */
  async wTransact(aLvlIso) {
    if (aLvlIso) {
      // See:
      //
      //   https://dev.mysql.com/doc/refman/8.0/en/set-transaction.html
      //
      const oSQL = "SET TRANSACTION ISOLATION LEVEL " + aLvlIso;
      await this.cConnBase.query(oSQL);
    }

    await this.cConnBase.beginTransaction();
  }

  /** Rolls the transaction back. */
  async wRollback() {
    await this.cConnBase.rollback();
  }

  /** Commits the transaction. */
  async wCommit() {
    await this.cConnBase.commit();
  }

  /** Runs a query without preparing it, then returns the result. */
  async wExec(aSQL, aParams) {
    return await wExec_ConnBase(this.cConnBase, aSQL, aParams);
  }

  /** Prepares a query, runs it, and then returns the result. */
  async wExecPrep(aSQL, aParams) {
    return await wExecPrep_ConnBase(this.cConnBase, aSQL, aParams);
  }

  /** Releases the connection. This must be called when you are done with this
   *  instance. */
  Release() {
    return this.cConnBase.release();
  }
}

/** Returns a new connection object that can be used to start a transaction. The
 *  connection must be explicitly closed with its Release method when you are
 *  done. */
export async function wConnNew() {
  // I would prefer to have this in the constructor, but that can't be marked
  // 'async':
  const oConnBase = await PoolBase.getConnection();
  return new tConnTransact(oConnBase);
}

// -------------
// SQL utilities
// -------------

/** Returns SQL boolean text representing the truthiness of the specified value. */
export function SQLBool(aVal) {
  return aVal ? "TRUE" : "FALSE";
}

/** Adds percent signs to both sides of the specified parameter (for use in a
 *  LIKE expression) then escapes and returns it. */
export function EscLike(aParam) {
  // When a parameter placeholder appears between percent signs in the SQL
  // template, 'node-mysql2' places the single quotes inside the percent signs,
  // which is wrong. Some discussion of the problem is found here:
  //
  //   https://stackoverflow.com/questions/17922587/node-mysql-escape-like-statement
  //
  // 'escape' also adds single quotes:
  return escape(`%${aParam}%`);
}

// ------------------
// Field enumerations
// ------------------
// I'm storing the Text values in objects in case other data is needed later.

/** Converts a 'Cds' object to an array. */
export function ArrayFromCds(aCds) {
  const oArray = [];
  for (const oCd in aCds) {
    const oEl = {
      Cd: oCd,
      ...aCds[oCd],
    };
    oArray.push(oEl);
  }
  return oArray;
}

export const CdsPhaseCyc = Object.freeze({
  // This phase is active only when the app is first installed, and later,
  // temporarily, between the end of one cycle and the StartCyc event of the
  // next. Because it is active between WhenEndCyc and WhenStartCyc, it has zero
  // length:
  PendCyc: {
    Idx: 0,
    Text: "Cycle pending",
    NamePhaseNext: "StartCyc",
  },
  StartCyc: {
    Idx: 1,
    Text: "Cycle started",
    NamePhaseNext: "StartShop",
  },
  StartShop: {
    Idx: 2,
    Text: "Shopping Start",
    NamePhaseNext: "EndShop",
  },
  EndShop: {
    Idx: 3,
    Text: "Shopping ended",
    NamePhaseNext: "StartDeliv",
  },
  StartDeliv: {
    Idx: 4,
    Text: "Delivery started",
    NamePhaseNext: "EndDeliv",
  },
  EndDeliv: {
    Idx: 5,
    Text: "Delivery ended",
    NamePhaseNext: "StartPickup",
  },
  StartPickup: {
    Idx: 6,
    Text: "Pickup started",
    NamePhaseNext: "EndPickup",
  },
  EndPickup: {
    Idx: 7,
    Text: "Pickup ended",
    NamePhaseNext: "EndCyc",
  },
});

/** Returns data for the specified phase codes, throwing if either is invalid. */
function PhasesCyc(aCd0, aCd1) {
  const oPhase0 = CdsPhaseCyc[aCd0];
  const oPhase1 = CdsPhaseCyc[aCd1];
  if (!oPhase0 || !oPhase1) throw Error("Db PhasesCyc: Invalid cycle phase code");
  return [oPhase0, oPhase1];
}

/** Returns 'true' if phase aCdL precedes aCdR in the cycle. */
export function PhaseCycLess(aCdL, aCdR) {
  const [oPhaseL, oPhaseR] = PhasesCyc(aCdL, aCdR);
  return oPhaseL.Idx < oPhaseR.Idx;
}

/** Returns 'true' if phase aCdL precedes aCdR in the cycle, or if they are
 *  equal. */
export function PhaseCycLessEq(aCdL, aCdR) {
  const [oPhaseL, oPhaseR] = PhasesCyc(aCdL, aCdR);
  return oPhaseL.Idx <= oPhaseR.Idx;
}

/** Returns 'true' if aCdL and aCdR specify the same cycle phase. */
export function PhaseCycEq(aCdL, aCdR) {
  // Why not just compare the strings? [TO DO]

  const [oPhaseL, oPhaseR] = PhasesCyc(aCdL, aCdR);
  return oPhaseL.Idx === oPhaseR.Idx;
}

/** Returns 'true' if phase aCdL follows aCdR in the cycle, or if they are
 *  equal. */
export function PhaseCycGreaterEq(aCdL, aCdR) {
  const [oPhaseL, oPhaseR] = PhasesCyc(aCdL, aCdR);
  return oPhaseL.Idx >= oPhaseR.Idx;
}

/** Returns 'true' if phase aCdL follows aCdR in the cycle. */
export function PhaseCycGreater(aCdL, aCdR) {
  const [oPhaseL, oPhaseR] = PhasesCyc(aCdL, aCdR);
  return oPhaseL.Idx > oPhaseR.Idx;
}

/** Returns 'true' if phase aCd is equal to aCdStart or follows it in the cycle,
 *  and if it precedes aCdNext. */
export function PhaseBetw(aCd, aCdStart, aCdNext) {
  const oPhaseCurr = CdsPhaseCyc[aCd];
  if (!oPhaseCurr) throw Error("Db PhaseBetw: Invalid current cycle phase code");

  const oPhaseStart = CdsPhaseCyc[aCdStart];
  if (!oPhaseStart) throw Error("Db PhaseBetw: Invalid start cycle phase code");

  const oPhaseNext = CdsPhaseCyc[aCdNext];
  if (!oPhaseNext) throw Error("Db PhaseBetw: Invalid next cycle phase code");

  return oPhaseStart.Idx <= oPhaseCurr.Idx && oPhaseCurr.Idx < oPhaseNext.Idx;
}

export const CdsTypeLoc = Object.freeze({
  Central: { Text: "Central pickup" },
  Satel: { Text: "Satellite pickup" },
  Deliv: { Text: "Home delivery" },
});

export const CdsReg = Object.freeze({
  Avail: { Text: "Available" },
  Pend: { Text: "Pending" },
  Approv: { Text: "Approved" },
  Susp: { Text: "Suspended" },
});

export const CdsVtyType = Object.freeze({
  Retail: { Text: "Retail" },
  Wholesale: { Text: "Wholesale" },
});

export const CdsVtyTypeAbbrev = Object.freeze({
  Retail: { Text: "R" },
  Wholesale: { Text: "W" },
});

export const CdsStaff = Object.freeze({
  StaffSuper: { Text: "IFC superuser" },
  StaffMgr: { Text: "IFC manager" },
  StaffAccts: { Text: "IFC accounting staff" },
  StaffDistrib: { Text: "IFC distribution staff" },
  NotStaff: { Text: "Not IFC staff" },
});

export const CdsStaffAssign = Object.freeze({
  // 'Superuser' must be assigned in the database, by a developer.

  // 'Manager' can be assigned in the app, but it must be unassigned in the
  // database, like 'Superuser':
  StaffMgr: CdsStaff.StaffMgr,
  StaffAccts: CdsStaff.StaffAccts,
  StaffDistrib: CdsStaff.StaffDistrib,
  NotStaff: CdsStaff.NotStaff,
});

export const CdsProductMeat = Object.freeze({
  None: { Text: "None" },
  Live: { Text: "Live" },
  Cuts: { Text: "Cuts" },
});

export const CdsStor = Object.freeze({
  NON: { Text: "Unrefrigerated" },
  REF: { Text: "Refrigerated (not dairy/eggs)" },
  DAIR: { Text: "Refrigerated (dairy)" },
  EGGS: { Text: "Refrigerated (eggs)" },
  FROZ: { Text: "Frozen" },
  PLNT: { Text: "Live plants" },
});

export const CdsAttrProduct = Object.freeze({
  // This order determines the display order on the Market Home page:
  OrganCert: { Text: "Certified Organic" },
  NaturGrownCert: { Text: "Certified Naturally Grown" },
  RealOrganic: { Text: "Real Organic Project" },
  //RegenOrganCert : { Text: "Regenerative Organic Certification" },
  //CertBiodynamic : { Text: "Certified Biodynamic" },
  LocalSelf: { Text: "Self Declared Growing Practices" },
  AnimWelfareCert: { Text: "Animal Welfare Certified" },
  //Cert100GrassFed: { Text: "Certified 100% Grass-Fed" },
  GrassFedSelf: { Text: "100% Grass-fed" },
  PasturedSelf: { Text: "Pastured" },
  FreeRgSelf: { Text: "Free Range" },
  //GlutenFreeCert: { Text: "Certified Gluten-Free" },
  GlutenFree: { Text: "Gluten-Free" },
  //VeganCert: { Text: "Certified Vegan" },
  Vegan: { Text: "Vegan or Dairy-free" },
  Veget: { Text: "Vegetarian" },
  //FairTradeCert: { Text: "Certified Fair Trade" }

  /* Old production types */
  //RaisedCertOrgan: { Text: "Raised Certified Organic" },
  //CageFreeSelf: { Text: "Cage free" },
  //IntegPestMgmtSelf: { Text: "Integrated Pest Management" },
  //FairTradeCert: { Text: "Certified Fair Trade" },
  //NaturGrownSelf: { Text: "Naturally grown" },
  //HormAntibFreeSelf: { Text: "Hormone & antibiotic-free" },
});

export const CdsListVty = Object.freeze({
  ListWeb: { Text: "Listed (web only)" },
  ListBoth: { Text: "Listed (web and on-site)" },
  ListOnsite: { Text: "Listed (on-site only)" },
  Unlist: { Text: "Unlisted" },
  Archiv: { Text: "Archived" },
});

export const CdsListVtyWeb = Object.freeze({
  // Non-staff are not allowed to set the on-site flag:
  ListWeb: CdsListVty.ListWeb,
  Unlist: CdsListVty.Unlist,
  Archiv: CdsListVty.Archiv,
});

export const CdsListVtyOnsite = Object.freeze({
  // Non-staff are not allowed to unset the on-site flag:
  ListOnsite: CdsListVty.ListOnsite,
  ListBoth: CdsListVty.ListBoth,
});

export const CdsListVtyOnsiteOnly = Object.freeze({
  // Non-staff are not allowed to unset the on-site flag:
  ListOnsite: CdsListVty.ListOnsite,
  Unlist: CdsListVty.Unlist,
  Archiv: CdsListVty.Archiv,
});

/** Returns variety listing codes appropriate for the specified variety and
 *  staff status. */
export function CdsListVtyValid(aVty, aCkStaff) {
  if (aCkStaff) return CdsListVty;
  if (aVty.CkListOnsite) return CdsListVtyOnsite;
  return CdsListVtyWeb;
}

/** Returns the variety listing code appropriate for the specified variety. */
export function CdListVtyFromCks(aVty) {
  if (aVty.CkArchiv) return "Archiv";
  if (aVty.CkListWeb && aVty.CkListOnsite) return "ListBoth";
  if (aVty.CkListWeb) return "ListWeb";
  if (aVty.CkListOnsite) return "ListOnsite";
  return "Unlist";
}

/** Returns an object containing listing and archive flags consistent with the
 *  specified listing code. */
export function CksFromCdListVty(aCd) {
  switch (aCd) {
    case "ListWeb":
      return { CkListWeb: true, CkListOnsite: false, CkArchiv: false };
    case "ListBoth":
      return { CkListWeb: true, CkListOnsite: true, CkArchiv: false };
    case "ListOnsite":
      return { CkListWeb: false, CkListOnsite: true, CkArchiv: false };
    case "Unlist":
      return { CkListWeb: false, CkListOnsite: false, CkArchiv: false };
    case "Archiv":
      return { CkListWeb: false, CkListOnsite: false, CkArchiv: true };
    default:
      throw Error("Db CksFromCdListVty: Invalid listing code");
  }
}

export const CdsTypeTransact = Object.freeze({
  Migrate: { Text: "Balance migration" },
  FeeMembInit: { Text: "Membership fee (initial)" },
  FeeMembRenew: { Text: "Membership fee (renewal)" },
  RefundFeeMembInit: { Text: "Refund (initial membership fee)" },
  EarnInvcProducerWeb: { Text: "Earnings (web sales)" },
  EarnInvcProducerOnsite: { Text: "Earnings (on-site retail sales)" },
  EarnInvcProducerOnsiteWholesale: {
    Text: "Earnings (on-site wholesale sales)",
  },
  ChargeInvcShopWeb: { Text: "Charge (web purchase)" },
  ChargeInvcShopOnsite: { Text: "Charge (on-site retail purchase)" },
  ChargeInvcShopOnsiteWholesale: {
    Text: "Charge (on-site wholesale purchase)",
  },
  PayRecv: { Text: "Payment receipt" },
  PaySent: { Text: "Payment disbursement" },
  Adj: { Text: "Adjustment" },
});

export const CdsTypeTransactStaff = Object.freeze({
  // Why not reuse the definitions in CdsTypeTransact?: [TO DO]
  RefundFeeMembInit: { Text: "Refund (initial membership fee)" },
  PayRecv: { Text: "Payment receipt" },
  PaySent: { Text: "Payment disbursement" },
  Adj: { Text: "Adjustment" },
});

export const CdsMethPay = Object.freeze({
  Check: { Text: "Check" },
  Credit: { Text: "Credit card" },
  Debit: { Text: "Debit card" },
  PayPal: { Text: "PayPal" },
  GiftCert: { Text: "Gift certificate" },
  Coupon: { Text: "Coupon" },
  Cash: { Text: "Cash" },
  EBTElec: { Text: "EBT electronic payment" },
  EBTVouch: { Text: "EBT voucher" },
});

// --------------
// Common queries
// --------------

/** Returns the site configuration data, as an object. */
export async function wSite(aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT * FROM Site`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  if (oRows.length !== 1) throw Error("Db wSite: Invalid site configuration count");
  // To avoid confusion. This field exists only to meet the primary key
  // requirement:
  delete oRows[0].z;
  return oRows[0];
}

/** Records an application event. */
//
// Note that there is no need to call this when the StApp.CdPhaseCyc changes;
// the StApp_AfterUpd trigger does that automatically.
export async function wAdd_EvtApp(aCdEvtApp, aIDMemb, aIDProducer, aIDMembStaffCreate, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `INSERT INTO EvtApp (CdEvtApp, IDMemb, IDProducer, IDMembStaffCreate)
		VALUES (:CdEvtApp, :IDMemb, :IDProducer, :IDMembStaffCreate)`;
  const oParams = {
    CdEvtApp: aCdEvtApp,
    IDMemb: aIDMemb,
    IDProducer: aIDProducer,
    IDMembStaffCreate: aIDMembStaffCreate,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows != 1) throw Error("Db wAdd_EvtApp: Cannot insert event record");
}

// Application state
// -----------------

/** Returns the application state data, as an object. */
export async function wStApp(aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT * FROM StApp`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  if (oRows.length !== 1) throw Error("Db wStApp: Invalid state count");
  // To avoid confusion. This field exists only to meet the primary key
  // requirement:
  delete oRows[0].z;
  return oRows[0];
}

/** Share-locks the application state data, then returns it as an object. */
export async function wLock_StApp(aConn) {
  const oSQL = `SELECT *
		FROM StApp
		FOR SHARE`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  if (oRows.length !== 1) throw Error("Db wLock_StApp: Invalid state count");
  // To avoid confusion. This field exists only to meet the primary key
  // requirement:
  delete oRows[0].z;
  return oRows[0];
}

/** Returns the current cycle, plus the application state record. */
export async function wCycStApp(aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT *
		FROM Cyc
		JOIN StApp USING (IDCyc)`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  if (oRows.length !== 1) throw Error("Db wCycStApp: Invalid cycle count");
  return oRows[0];
}

/** Share-locks the current cycle and the application state record, then returns
 * them. */
export async function wLock_CycStApp(aConn) {
  // This does not lock Cyc records other than the current one; however, by also
  // locking the StApp record, it prevents any other cycle record from being
  // made current:
  const oSQL = `SELECT *
		FROM Cyc
		JOIN StApp USING (IDCyc)
		FOR SHARE`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  if (oRows.length !== 1) throw Error("Db wLock_CycStApp: Invalid cycle count");
  return oRows[0];
}

// Cycles
// ------

/** Returns the specified cycle, or 'null' if there is no such. */
export async function wCycFromID(aIDCyc, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT *
		FROM Cyc
		WHERE IDCyc = :IDCyc`;
  const oParams = {
    IDCyc: aIDCyc,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);

  switch (oRows.length) {
    case 0:
      return null;
    case 1:
      return oRows[0];
    default:
      throw Error("Db wCycByID: Too many cycles");
  }
}

/** Returns the previous cycle, or 'null' if there isn't one. */
export async function wCycPrev(aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT *
		FROM Cyc
		WHERE (IDCyc < (SELECT IDCyc FROM StApp))
		ORDER BY IDCyc DESC
		LIMIT 1`;
  const [oRows] = await aConn.wExecPrep(oSQL);

  switch (oRows.length) {
    case 0:
      return null;
    case 1:
      return oRows[0];
    default:
      throw Error("Db wCycPrev: Too many 'previous' cycles");
  }
}

/** Returns the current cycle, throwing if there isn't one. */
export async function wCycCurr(aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT Cyc.*
		FROM Cyc
		JOIN StApp USING (IDCyc)`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  if (oRows.length !== 1) throw Error("Db wCycCurr: Invalid cycle count");
  return oRows[0];
}

/** Returns the 'next' cycle, throwing if there isn't one */
export async function wCycNext(aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT *
		FROM Cyc
		WHERE (IDCyc > (SELECT IDCyc FROM StApp))
		ORDER BY IDCyc
		LIMIT 1`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  if (oRows.length !== 1) throw Error("Db wCycNext: Invalid 'next' cycle count");
  return oRows[0];
}

/** Returns the cycles within the specified month count, as determined by the
 * pickup end time. */
export async function wCycsByEndPickup(aCtMonth) {
  const oSQL = `SELECT *
		FROM Cyc
		WHERE Cyc.WhenEndPickup >= DATE_SUB(NOW(), INTERVAL :CtMonth MONTH)
			AND Cyc.WhenEndPickup < NOW()
		ORDER BY IDCyc`;
  const oParams = {
    CtMonth: aCtMonth,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Returns the cycles within the specified month count, as determined by the
 * cycle end time. */
export async function wCycsByEndCyc(aCtMonth) {
  const oSQL = `SELECT *
		FROM Cyc
		WHERE Cyc.WhenEndCyc >= DATE_SUB(NOW(), INTERVAL :CtMonth MONTH)
			AND Cyc.WhenEndCyc < NOW()
		ORDER BY IDCyc`;
  const oParams = {
    CtMonth: aCtMonth,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

// Members
// -------

/** Returns the member with the specified ID, or 'null' if no match is found. */
export async function wMembFromID(aIDMemb, aConn) {
  if (!aConn) aConn = Conn;

  // Is it safe to SELECT and return everything? What if HashPass is
  // accidentally exposed? [TO DO]
  const oSQL = `SELECT Memb.*, Memb.WhenReg AS WhenRegMemb,
			Producer.IDProducer, Producer.CdProducer,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT,
      IFNULL(zMembTags.TagIDs, CAST('[]' AS JSON)) AS TagIDs,
      IFNULL(zMembTags.Tags, CAST('[]' AS JSON)) AS Tags
		FROM Memb
		LEFT JOIN Producer USING (IDMemb)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
     LEFT JOIN (
            SELECT
                MTA.IDMemb,
				CAST(CONCAT('[', GROUP_CONCAT(DISTINCT MTA.IDMemberTag ORDER BY MTA.IDMemberTag SEPARATOR ','), ']') AS JSON) AS TagIDs,
				CAST(CONCAT('[', GROUP_CONCAT(DISTINCT JSON_QUOTE(MT.Tag) ORDER BY MT.Tag SEPARATOR ','), ']') AS JSON) AS Tags
            FROM MemberTagAssignments AS MTA
            LEFT JOIN MemberTags AS MT ON (MT.IDMemberTag = MTA.IDMemberTag)
            GROUP BY MTA.IDMemb
    ) AS zMembTags ON (zMembTags.IDMemb = Memb.IDMemb)
		WHERE Memb.IDMemb = ?`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDMemb]);
  return oRows.length ? oRows[0] : null;
}

/** Returns the member with the specified username, or 'null' if no match is
 *  found. */
export async function wMembFromNameLogin(aNameLogin) {
  // Is it safe to SELECT and return everything? What if HashPass is
  // accidentally exposed? [TO DO]
  const oSQL = `SELECT Memb.*,
			Producer.IDProducer, Producer.CdProducer,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT,
      IFNULL(zMembTags.TagIDs, CAST('[]' AS JSON)) AS TagIDs,
		IFNULL(zMembTags.Tags, CAST('[]' AS JSON)) AS Tags
		FROM Memb
		LEFT JOIN Producer USING (IDMemb)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE NameLogin = ?`;
  const [oRows] = await Conn.wExecPrep(oSQL, [aNameLogin]);
  return oRows.length ? oRows[0] : null;
}

/** Returns the member associated with the specified cart item, or 'null' if no
 *  match is found. */
export async function wMembFromIDItCart(aIDItCart) {
  // Is it safe to SELECT and return everything? What if HashPass is
  // accidentally exposed? [TO DO]
  const oSQL = `SELECT Memb.*
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN Memb Using (IDMemb)
		WHERE ItCart.IDItCart = ?`;
  const [oRows] = await Conn.wExecPrep(oSQL, [aIDItCart]);
  return oRows.length ? oRows[0] : null;
}

/** Replaces the specified member's password hash. */
export async function wUpd_PassMemb(aIDMemb, aPassNew) {
  const oSQL = `UPDATE Memb
		SET HashPass = :HashPass
		WHERE IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
    HashPass: await wHash(aPassNew),
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows < 1) throw Error("Db wChgPass: Failed to store new password");
}

/** Returns the specified member's next membership fee, whether initial or
 *  renewal. */
export async function wFeeMembNextFromIDMemb(aIDMemb) {
  const oSQL = `SELECT COUNT(*) AS CkInit
		FROM Transact
		WHERE CdTypeTransact = 'FeeMembInit'
			AND IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length && oRows[0].CkInit ? Site.FeeMembRenew : Site.FeeMembInit;
}

/** Returns the specified members's web shopper invoice metadata for this cycle,
 *  or 'null' if the member hasn't checked-out. */
export async function wInvcShopWeb(aIDMemb, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT InvcShopWeb.*
		FROM InvcShopWeb
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

// Producers
// ---------

/** Returns the producer with the specified ID, or 'null' if no match is
 *  found. */
export async function wProducerFromID(aIDProducer, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT Producer.*, Producer.WhenReg AS WhenRegProducer,
			Memb.NameLogin, Memb.Name1First, Memb.Name1Last,
			Memb.Name2First, Memb.Name2Last,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT
		FROM Producer
		JOIN Memb ON Memb.IDMemb = Producer.IDMemb
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact ON zTransact.IDMemb = Producer.IDMemb
		WHERE Producer.IDProducer = ?`;
  const [oRows, _oFlds] = await aConn.wExecPrep(oSQL, [aIDProducer]);
  return oRows.length ? oRows[0] : null;
}

/** Returns the producer with the specified member ID, or 'null' if no match is
 *  found. */
export async function wProducerFromIDMemb(aIDMemb, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT Producer.*,
			Memb.NameLogin, Memb.Name1First, Memb.Name1Last,
			Memb.Name2First, Memb.Name2Last,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT
		FROM Producer
		JOIN Memb ON Memb.IDMemb = Producer.IDMemb
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact ON zTransact.IDMemb = Producer.IDMemb
		WHERE Producer.IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oRows, _oFlds] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

export async function wProducerFromIDProduct(aIDProduct, aConn) {
  if (!aConn) aConn = Conn;
  const sql = `
		SELECT Producer.* 
		FROM Product
		JOIN Producer USING (IDProducer)
		WHERE IDProduct = :idProductToFind;
		`;
  const params = {
    idProductToFind: aIDProduct,
  };
  const [producerRows] = await aConn.wExecPrep(sql, params);
  return producerRows.length ? producerRows[0] : null;
}
/** Toggles the specified product's favorite status for the specified member. */
export async function wToggleFavorite(aIDMemb, aIDProduct, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `CALL ToggleFavorite(?, ?)`;
  await aConn.wExecPrep(oSQL, [aIDMemb, aIDProduct]);
}

export async function wPopulateIsFavorited(aIDMemb, aIDProducts, aConn) {
  if (!aConn) aConn = Conn;
  if (!aIDProducts.length) return;

  const oSQL = `SELECT IDProduct
    FROM IMembFavorites
    WHERE IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);

  const favSet = new Set(oRows.map(r => r.IDProduct));
  aIDProducts.forEach(p => {
    p.IsFavorited = favSet.has(p.IDProduct);
  });
}

export async function wProducersActivWeb() {
  const oSQL = `SELECT DISTINCT Producer.*
		FROM Producer
		JOIN Product USING (IDProducer)
		JOIN Vty USING (IDProduct)
		WHERE (Producer.CdRegProducer = 'Approv')
			AND (Producer.CkListProducer IS TRUE)
			AND (Vty.CkListWeb IS TRUE)
			AND (Vty.QtyOffer > 0)
		ORDER BY Producer.NameBus, Producer.IDProducer`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL);
  return oRows;
}

/** Returns the number of items promised by the specified producer. */
export async function wQtyPromProducer(aIDProducer, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT IFNULL(SUM(ItCart.QtyProm), 0) AS QtyProm
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		WHERE Product.IDProducer = ?`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDProducer]);
  if (!oRows.length) throw Error("Db wQtyPromProducer: Cannot get promised quantity");
  return oRows[0].QtyProm;
}

/** Returns the specified producer's web producer invoice metadata for this
 *  cycle, or 'null' if the producer hasn't checked-in. */
export async function wInvcProducerWeb(aIDProducer, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT InvcProducerWeb.*
		FROM InvcProducerWeb
		JOIN StApp USING (IDCyc)
		WHERE IDProducer = :IDProducer`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

/** Update-locks the specified producer's web producer invoice metadata for this
 *  cycle, then returns it, or 'null' if the producer hasn't checked-in. */
export async function wLock_InvcProducerWeb(aConn, aIDProducer) {
  // Phantom rows would be a problem here (at least, when using the REPEATABLE
  // READ isolation level) but I believe InnoDB's 'gap locking' handles that for
  // us:
  //
  //   https://dev.mysql.com/doc/refman/8.0/en/innodb-next-key-locking.html
  //
  // In particular:
  //
  //   "You can use next-key locking to implement a uniqueness check in your
  //   application: If you read your data in share mode and do not see a
  //   duplicate for a row you are going to insert, then you can safely insert
  //   your row and know that the next-key lock set on the successor of your row
  //   during the read prevents anyone meanwhile inserting a duplicate for your
  //   row. Thus, the next-key locking enables you to “lock” the nonexistence of
  //   something in your table."
  //
  const oSQL = `SELECT InvcProducerWeb.*
		FROM InvcProducerWeb
		JOIN StApp USING (IDCyc)
		WHERE IDProducer = :IDProducer
		FOR UPDATE`;
  const oParams = {
    IDProducer: aIDProducer,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

// Categories and subcategories
// ----------------------------

/** Returns the specified category, or 'null' if no match is found. */
//
// Note that the same data is cached in gSite.
export async function wCatFromID(aIDCat) {
  const oSQL = `SELECT *
		FROM Cat
		WHERE IDCat = :IDCat`;
  const oParams = {
    IDCat: aIDCat,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

/** Returns all product categories. */
//
// Note that the same data is cached in gSite.
export async function wCats() {
  const oSQL = `SELECT *
		FROM Cat
		ORDER BY NameCat, IDCat`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL);
  return oRows;
}

/** Returns all product categories except the one specified. */
export async function wCatsExcept(aIDCat) {
  const oSQL = `SELECT *
		FROM Cat
		WHERE IDCat != :IDCat
		ORDER BY NameCat, IDCat`;
  const oParams = {
    IDCat: aIDCat,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Returns all product categories, with an added 'Ck' field that indicates
 *  whether each category has been selected by the specified producer. */
export async function wCatsProducerCk(aIDProducer) {
  const oSQL = `SELECT *,
			EXISTS (SELECT * FROM CatProducer
				WHERE CatProducer.IDCat = Cat.IDCat
					AND CatProducer.IDProducer = ?
			) AS Ck
		FROM Cat
		ORDER BY NameCat, IDCat`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, [aIDProducer]);
  return oRows;
}

/** Replaces a producer's product category selections. */
export async function wUpd_CatsProducer(aIDProducer, aIDsCats) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // Delete existing records
    // -----------------------

    const oSQLDel = `DELETE FROM CatProducer WHERE IDProducer = ?`;
    await oConn.wExecPrep(oSQLDel, [aIDProducer]);

    // Add new records
    // ---------------

    const oSQLIns = `INSERT INTO CatProducer (IDProducer, IDCat)
			VALUES (:IDProducer, :IDCat)`;
    for (const oIDCat of aIDsCats) {
      const oParams = {
        IDProducer: aIDProducer,
        IDCat: oIDCat,
      };
      await oConn.wExecPrep(oSQLIns, oParams);
    }

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    throw aErr;
  } finally {
    oConn.Release();
  }
}

/** Replaces a member's tag assignments. */
export async function wUpd_MembTags(aIDMemb, aIDsTags) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // Delete existing records
    const oSQLDel = `DELETE FROM MemberTagAssignments WHERE IDMemb = ?`;
    await oConn.wExecPrep(oSQLDel, [aIDMemb]);

    // Add new records (dedupe in case caller provides duplicates)
    const oSQLIns = `INSERT INTO MemberTagAssignments (IDMemberTag, IDMemb)
      VALUES (:IDMemberTag, :IDMemb)`;
    const oSet = new Set(aIDsTags || []);
    for (const oIDTag of oSet) {
      const oParams = {
        IDMemberTag: oIDTag,
        IDMemb: aIDMemb,
      };
      await oConn.wExecPrep(oSQLIns, oParams);
    }

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    throw aErr;
  } finally {
    oConn.Release();
  }
}

/** Returns the specified subcategory, or 'null' if no match is found. */
//
// Note that the same data is cached in gSite.
export async function wSubcatFromID(aIDSubcat) {
  const oSQL = `SELECT *
		FROM Subcat
		WHERE IDSubcat = :IDSubcat`;
  const oParams = {
    IDSubcat: aIDSubcat,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

/** Returns all product subcategories. */
//
// Note that the same data is cached in gSite.
export async function wSubcats() {
  const oSQL = `SELECT *
		FROM Subcat
		ORDER BY NameSubcat, IDSubcat`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}

/** Returns all product subcategories in aIDCat, except for aIDSubcat. */
export async function wSubcatsByCatExcept(aIDCat, aIDSubcat) {
  const oSQL = `SELECT *
		FROM Subcat
		WHERE (IDCat = :IDCat) AND (IDSubcat != :IDSubcat)
		ORDER BY NameSubcat, IDSubcat`;
  const oParams = {
    IDCat: aIDCat,
    IDSubcat: aIDSubcat,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Returns the product subcategories available to the specified producer. */
export async function wSubcatsProducer(aIDProducer) {
  const oSQL = `SELECT Subcat.IDSubcat, Subcat.NameSubcat,
			Cat.IDCat, Cat.NameCat
		FROM Subcat
		JOIN Cat USING (IDCat)
		JOIN CatProducer USING (IDCat)
		WHERE CatProducer.IDProducer = ?
		ORDER BY NameCat, IDCat, NameSubcat, IDSubcat`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, [aIDProducer]);
  return oRows;
}

// Products and varieties
// ----------------------

/** Returns the specified product, or 'null' if no match is found. */
export async function wProductFromID(aIDProduct) {
  const oSQL = `SELECT Product.*,
			Producer.CdProducer, Producer.NameBus, Producer.NameImgProducer, Producer.CdRegWholesale,
			Subcat.IDSubcat, Subcat.NameSubcat,
			Cat.IDCat, Cat.NameCat
		FROM Product
		LEFT JOIN Producer USING (IDProducer)
		LEFT JOIN Subcat USING (IDSubcat)
		LEFT JOIN Cat USING (IDCat)
		WHERE IDProduct = :IDProduct`;
  const oParams = {
    IDProduct: aIDProduct,
  };
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

/** Returns the specified product's varieties, with order totals from this and
 *  the specified cycle. */
export async function wVtysQtyOrdCycFromIDProduct(aIDProduct, aIDCyc) {
  const oSQL = `SELECT Vty.*,
			IFNULL(zItCartVty.QtyOrd, 0) AS QtyOrd,
			IFNULL(zItCartVty.QtyProm, 0) AS QtyProm,
			IFNULL(zItCartVtyCyc.QtyOrd, 0) AS QtyOrdCyc
		FROM Vty
		LEFT JOIN (
			SELECT Vty.IDVty,
				SUM(ItCart.QtyOrd) AS QtyOrd, SUM(ItCart.QtyProm) AS QtyProm
			FROM Vty
			JOIN ItCart USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY Vty.IDVty
		) AS zItCartVty USING (IDVty)
		LEFT JOIN (
			SELECT ItCart.IDVty,
				SUM(ItCart.QtyOrd) AS QtyOrd
			FROM ItCart
			JOIN Cart USING (IDCart)
			WHERE IDCyc = :IDCyc
			GROUP BY ItCart.IDVty
		) AS zItCartVtyCyc USING (IDVty)
		WHERE IDProduct = :IDProduct
		ORDER BY Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDProduct: aIDProduct,
    IDCyc: aIDCyc,
  };
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Returns the specified variety, or 'null' if no match is found. */
export async function wVtyFromID(aIDVty, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT Vty.*,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			IFNULL(zItCartVty.QtyProm, 0) AS QtyProm,
			Product.NameProduct,
			Product.CkExcludeConsumerFee,
			Producer.IDProducer, Producer.CdProducer, Producer.NameBus
		FROM Vty
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		LEFT JOIN (
			SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
			FROM Vty
			JOIN ItCart USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY Vty.IDVty
		) AS zItCartVty USING (IDVty)
		WHERE IDVty = ?`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDVty]);
  return oRows.length ? oRows[0] : null;
}

// Carts
// -----

/** Returns the specified member's cart record for the current cycle. Returns
 *  'null' if they have no cart. */
export async function wCartFromIDMemb(aIDMemb, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT *
		FROM Cart
		JOIN StApp USING (IDCyc)
		WHERE IDMemb = :IDMemb`;
  const oData = {
    IDMemb: aIDMemb,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oData);
  return oRows.length ? oRows[0] : null;
}

/** Update-locks and then returns the specified member's cart record for the
 *  current cycle. Returns 'null' if they have no cart. */
export async function wLock_CartFromIDMemb(aConn, aIDMemb) {
  // There is a unique index that prevents the member from having more than one
  // Cart record in a given cycle, so we do not need to worry here about phantom
  // rows:
  const oSQL = `SELECT *
		FROM Cart
		JOIN StApp USING (IDCyc)
		WHERE IDMemb = :IDMemb
		FOR UPDATE`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

/** Returns the specified member's cart record for the current cycle, creating
 *  one as necessary if aCkCreate is 'true'. Returns 'null' if there is no cart. */
export async function wCartOrCreate(aIDMemb, aCkCreate, aConn) {
  if (!aConn) aConn = Conn;

  let oCart = await wCartFromIDMemb(aIDMemb, aConn);
  if (oCart) return oCart;

  if (!aCkCreate) return null;

  // There is a race condition here, but the database will reject the second
  // attempt to insert a given IDCyc/IDMemb combination. For that reason, we
  // will not check whether the insert succeeded:
  const oSQLIns = `INSERT INTO Cart (IDCyc, IDMemb, CdLoc)
		SELECT StApp.IDCyc, Memb.IDMemb, Memb.CdLocLast
		FROM Memb, StApp
		WHERE IDMemb = :IDMemb`;
  const oDataIns = {
    IDMemb: aIDMemb,
  };
  await aConn.wExecPrep(oSQLIns, oDataIns);

  oCart = await wCartFromIDMemb(aIDMemb, aConn);
  if (oCart) return oCart;

  throw Error("Db wCartOrCreate: Cannot select inserted record");
}

/** Update-locks the specified member's cart record for the current cycle,
 *  creating one as necessary if aCkCreate is 'true', then returns it, or 'null'
 *  if there is no cart. */
export async function wLock_CartOrCreate(aConn, aIDMemb, aCkCreate) {
  let oCart = await wLock_CartFromIDMemb(aConn, aIDMemb);
  if (oCart) return oCart;

  if (!aCkCreate) return null;

  // There is a race condition here, but the database will reject the second
  // attempt to insert a given IDCyc/IDMemb combination. For that reason, we
  // will not check whether the insert succeeded:
  const oSQLIns = `INSERT INTO Cart (IDCyc, IDMemb, CdLoc)
		SELECT StApp.IDCyc, Memb.IDMemb, Memb.CdLocLast
		FROM Memb, StApp
		WHERE IDMemb = :IDMemb`;
  const oDataIns = {
    IDMemb: aIDMemb,
  };
  await aConn.wExecPrep(oSQLIns, oDataIns);

  oCart = await wLock_CartFromIDMemb(aConn, aIDMemb);
  if (oCart) return oCart;

  throw Error("Db wLock_CartOrCreate: Cannot select inserted record");
}

/** Returns cart data for the specified member and cart. If no cart is
 *  specified, the current cart is used. Returns 'null' if there is no current
 *  cart. Available quantities cannot be derived from this data after the
 *  delivery window has closed; see wItsCartFromIDCart for more on that. */
//
// This is a bad name: [TO DO]
export async function wSummCart(aMemb, aCart, aConn) {
  if (!aConn) aConn = Conn;

  if (!aMemb) throw Error(`Db wSummCart: Member not set`);

  if (!aCart) {
    aCart = await wCartFromIDMemb(aMemb.IDMemb, aConn);
    if (!aCart) return null;
  }

  const oIts = await wItsCartFromIDCart(aCart.IDCart, aConn);
  const oItsExtended = await Add_CkExcludeConsumerFee(oIts);
  return SummCart(aCart, oItsExtended, aMemb);
}

/** Returns current-cycle cart data for the specified member, creating the cart
 *  as necessary if aCkCreate is 'true'. Returns 'null' if there is no cart.
 *  Available quantities cannot be derived from this data after the delivery
 *  window has closed; see wItsCartFromIDCart for more on that. */
export async function wSummCartOrCreate(aMemb, aCkCreate) {
  if (!aMemb) throw Error(`Db wSummCartOrCreate: Member not set`);

  const oCart = await wCartOrCreate(aMemb.IDMemb, aCkCreate);
  if (!oCart) return null;

  const oIts = await wItsCartFromIDCart(oCart.IDCart);
  const oItsExtended = await Add_CkExcludeConsumerFee(oIts);
  return SummCart(oCart, oItsExtended, aMemb);
}

/** Returns an array containing items from the specified cart. These promise
 *  quantities always reflect the current cycle, yet the delivery quantities
 *  will have been subtracted from the offer quantities if the delivery window
 *  has closed, so it will not be possible to calculate available quantities
 *  after that point. */
async function wItsCartFromIDCart(aIDCart, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = "CALL ItsCartFromIDCart(?)";
  const [oOut] = await aConn.wExecPrep(oSQL, [aIDCart]);
  return oOut.length ? oOut[0] : null;
}

/** Returns the cart ID, if any, and the number of items promised to the
 *  specified member. The cart ID will be 'null' if no cart has been created.*/
export async function wDataPromMemb(aIDMemb, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT Cart.IDCart, IFNULL(SUM(ItCart.QtyProm), 0) AS QtyProm
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE Cart.IDMemb = ?
		GROUP BY Cart.IDCart`;
  const [oRows] = await aConn.wExecPrep(oSQL, [aIDMemb]);
  if (!oRows.length) return { IDCart: null, QtyProm: null };
  return oRows[0];
}

export async function wUpd_CdLocCart(aIDCart, aCdLoc, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `UPDATE Cart
		SET CdLoc = :CdLoc
		WHERE IDCart = :IDCart`;
  const oData = {
    IDCart: aIDCart,
    CdLoc: aCdLoc,
  };
  await aConn.wExecPrep(oSQL, oData);
}

export async function wUpd_CdLocLastMemb(aIDMemb, aCdLoc, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `UPDATE Memb
		SET CdLocLast = :CdLoc
		WHERE IDMemb = :IDMemb`;
  const oData = {
    IDMemb: aIDMemb,
    CdLoc: aCdLoc,
  };
  await aConn.wExecPrep(oSQL, oData);
}

// Locations
// ---------

/** Returns all locations. */
export async function wLocs() {
  const oSQL = `SELECT *
		FROM Loc
		ORDER BY NameLoc, CdLoc`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}

/** Returns all active locations. */
export async function wLocsActiv() {
  const oSQL = `SELECT *
		FROM Loc
		WHERE (CkActiv IS TRUE)
		ORDER BY NameLoc, CdLoc`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}

/** Returns all active satellite locations. */
export async function wLocsSatelActiv() {
  const oSQL = `SELECT *
		FROM Loc
		WHERE (CdTypeLoc = 'Satel') AND (CkActiv IS TRUE)
		ORDER BY NameLoc, CdLoc`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}

// Transactions
// ------------

/** Returns the transaction with the specified ID, or 'null' if no match is
 *  found. */
export async function wTransactFromID(aIDTransact, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT Transact.*,
			Memb.Name1First, Memb.Name1Last,
			Producer.NameBus AS NameBusProducer,
			MembCreate.Name1First AS Name1FirstCreate,
			MembCreate.Name1Last AS Name1LastCreate
		FROM Transact
		LEFT JOIN Memb USING (IDMemb)
		LEFT JOIN Producer USING (IDProducer)
		LEFT JOIN Memb AS MembCreate
			ON MembCreate.IDMemb = Transact.IDMembStaffCreate
		WHERE Transact.IDTransact = :IDTransact`;
  const oParams = {
    IDTransact: aIDTransact,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

export async function wAdd_Transact(
  aIDMemb,
  aCdTypeTransact,
  aAmtMoney,
  aAmtEBT,
  aIDMembStaffCreate,
  aOpts,
  aConn,
) {
  if (!aConn) aConn = Conn;

  if (!aOpts) aOpts = {};
  if (aOpts.IDProducer === undefined) aOpts.IDProducer = null;
  if (aOpts.IDInvc === undefined) aOpts.IDInvc = null;
  if (aOpts.CdMethPay === undefined) aOpts.CdMethPay = null;
  if (aOpts.FeeCoop === undefined) aOpts.FeeCoop = 0.0;
  if (aOpts.TaxSale === undefined) aOpts.TaxSale = 0.0;
  if (aOpts.Note === undefined) aOpts.Note = null;

  const oSQL = `INSERT INTO Transact (
			IDMemb, IDProducer, IDInvc, CdTypeTransact, CdMethPay,
			AmtMoney, AmtEBT, FeeCoop, TaxSale, Note, IDMembStaffCreate
		)
		VALUES (
			:IDMemb, :IDProducer, :IDInvc, :CdTypeTransact, :CdMethPay,
			:AmtMoney, :AmtEBT, :FeeCoop, :TaxSale, :Note, :IDMembStaffCreate
		)`;
  const oParams = {
    IDMemb: aIDMemb,
    CdTypeTransact: aCdTypeTransact,
    AmtMoney: aAmtMoney,
    AmtEBT: aAmtEBT,
    IDMembStaffCreate: aIDMembStaffCreate,
    ...aOpts,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows != 1) throw Error("Db wAdd_Transact: Cannot insert transaction");
}

// On-site
// -------

/** Returns the pending on-site cart associated with the specified session ID,
 *  or 'null' if there is no such cart. */
export async function wCartOnsitePend(aIDSess, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `SELECT *
		FROM CartOnsitePend
		WHERE IDSess = :IDSess`;
  const oData = {
    IDSess: aIDSess,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oData);

  if (oRows.length < 1) return null;
  if (oRows.length === 1) return oRows[0];
  throw Error("Db wCartOnsitePend: Invalid pending on-site cart count");
}

/** Returns the pending on-site cart associated with the specified staff member
 *  and session ID, creating it first if it does not exist. */
export async function wCartOnsitePendOrCreate(aIDSess, aIDMembStaff, aCdCartType, aConn) {
  if (!aConn) aConn = Conn;

  const oCdCartType = aCdCartType || "Retail";

  let oCart = await wCartOnsitePend(aIDSess, aConn);
  if (oCart) return oCart;

  // There is a race condition here, but the database will reject the second
  // attempt to insert a given session ID. For that reason, we will not check
  // whether the insert succeeded:
  const oSQLIns = `INSERT INTO CartOnsitePend (IDSess, IDMembStaffCreate, CdCartType)
		VALUES (:IDSess, :IDMembStaffCreate, :CdCartType)`;
  const oDataIns = {
    IDSess: aIDSess,
    IDMembStaffCreate: aIDMembStaff,
    CdCartType: oCdCartType,
  };
  await aConn.wExecPrep(oSQLIns, oDataIns);

  oCart = await wCartOnsitePend(aIDSess, aConn);
  if (!oCart) throw Error("Db wCartOnsitePendOrCreate: Cannot select inserted record");
  return oCart;
}

/** Returns the ItCartOnsitePend records for the pending cart. */
export async function wItsCartOnsitePend(aIDSess) {
  const oSQL = `SELECT ItCartOnsitePend.WgtPer, ItCartOnsitePend.Qty,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkInvtMgd, Vty.PriceNomOnsite, Vty.CdVtyType,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct,
			Subcat.CkTaxSale, Subcat.CkEBT,
			Producer.IDProducer, Producer.NameBus,
			IFNULL(FeeCoopVty.FracFeeCoopWholesaleMemb, (SELECT FracFeeCoopWholesaleMemb FROM Site)) AS FracFeeCoopWholesaleMemb
		FROM ItCartOnsitePend
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Subcat USING (IDSubcat)
		JOIN Producer USING (IDProducer)
		LEFT JOIN FeeCoopVty USING (IDVty)
		WHERE IDSess = :IDSess
		ORDER BY Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oData = {
    IDSess: aIDSess,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oData);
  return oRows;
}

export async function wAdd_ItCartOnsitePend(aIDSess, aIDVty, aWgt, aQty, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `INSERT INTO ItCartOnsitePend (
			IDSess, IDVty, WgtPer, Qty
		)
		VALUES (
			:IDSess, :IDVty, :Wgt, :Qty
		)
		ON DUPLICATE KEY UPDATE Qty = Qty + :Qty`;
  const oParams = {
    IDSess: aIDSess,
    IDVty: aIDVty,
    Wgt: aWgt,
    Qty: aQty,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  // For whatever reason, 'affectedRows' is two when the update is triggered:
  if (oRows.affectedRows < 1)
    throw Error(
      "add-to-on-site-cart wUpsert_ItCart: Cannot insert or update " +
        "pending on-site cart record",
    );
  return oRows.insertId;
}

export async function wDel_ItsCartOnsitePend(aIDSess, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `DELETE FROM ItCartOnsitePend
		WHERE IDSess = :IDSess`;
  const oParams = {
    IDSess: aIDSess,
  };
  await aConn.wExecPrep(oSQL, oParams);
}

export async function wDel_CartOnsitePend(aIDSess, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `DELETE FROM CartOnsitePend
		WHERE IDSess = :IDSess`;
  const oParams = {
    IDSess: aIDSess,
  };
  await aConn.wExecPrep(oSQL, oParams);
}

/** Associates a member with the specified on-site cart, or removes such an
 *  association, if aIDMemb is 'null'. */
export async function wAssoc_MembOnsitePend(aIDSess, aIDMemb, aCkEBTNonMemb, aConn) {
  if (!aConn) aConn = Conn;

  const oSQL = `UPDATE CartOnsitePend
		SET IDMembShop = :IDMembShop, CkEBTNonMemb = :CkEBTNonMemb
		WHERE IDSess = :IDSess`;
  const oData = {
    IDSess: aIDSess,
    IDMembShop: aIDMemb,
    CkEBTNonMemb: aCkEBTNonMemb,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oData);

  if (oRows.affectedRows != 1)
    throw Error("Db wAssoc_MembOnsitePend: Cannot update on-site cart record");
}

export async function getProductRow(productId, aConn) {
  if (!aConn) aConn = Conn;
  const sql = `SELECT CkExcludeProducerFee, CkExcludeConsumerFee 
	FROM Product WHERE IDProduct = :productIdToFind`;
  const params = {
    productIdToFind: productId,
  };
  const [productRow] = await aConn.wExecPrep(sql, params);
  return productRow;
}

export async function getProductRowFromIDItDeliv(idItDeliv, aConn) {
  if (!aConn) aConn = Conn;
  const sql = `
				SELECT CkExcludeProducerFee, CkExcludeConsumerFee 
				FROM ItDeliv 
				JOIN Vty USING (IDVty)
				JOIN Product USING (IDProduct)
				WHERE IDItDeliv = :idItDelivToFind
				`;
  const params = {
    idItDelivToFind: idItDeliv,
  };
  const [productRow] = await aConn.wExecPrep(sql, params);
  return productRow;
}

export async function getProductRowFromIDItCart(idItCart, aConn) {
  if (!aConn) aConn = Conn;
  const sql = `
				SELECT CkExcludeProducerFee, CkExcludeConsumerFee 
				FROM Itcart 
				JOIN Vty USING (IDVty)
				JOIN Product USING (IDProduct)
				WHERE IDItCart = :idItCartToFind
				`;
  const params = {
    idItCartToFind: idItCart,
  };
  const [productRow] = await aConn.wExecPrep(sql, params);
  return productRow;
}

export async function getProductRowFromIDItCartOnSite(idItCartOnsite, aConn) {
  if (!aConn) aConn = Conn;
  const sql = `
				SELECT CkExcludeProducerFee, CkExcludeConsumerFee 
				FROM Itcartonsite 
				JOIN Vty USING (IDVty)
				JOIN Product USING (IDProduct)
				WHERE IDItCartOnsite = :idItCartOnsiteToFind
				`;
  const params = {
    idItCartOnsiteToFind: idItCartOnsite,
  };
  const [productRow] = await aConn.wExecPrep(sql, params);
  return productRow;
}

export async function querySiteConfigurations() {
  const sql = `
				SELECT
					CtMonthTrialMembNew,
					FeeMembInit,
					FeeMembRenew,
					FeeInvtIt,
					FracFeeCoopProducer,
					FracFeeCoopShop,
					FeeTransfer,
					FeeDelivBase,
					FeeDelivMile,
					FracTaxSale,
					FracFeeCoopWholesaleMemb,
					FracFeeCoopWholesaleProducer
				FROM
					Site
				`;
  const [siteRow] = await Conn.wExecPrep(sql, {});
  return siteRow;
}

export async function queryMemberTags() {
  const sql = `
				SELECT
					IDMemberTag,
					Tag
				FROM
					MemberTags
				`;
  const [memberTags] = await Conn.wExecPrep(sql, {});
  return memberTags;
}

export async function queryMemberTagAssignments(memberId) {
  const sql = `
			SELECT
				IDMemberTagAssignment,
				MemberTagAssignments.IDMemberTag,
				IDMemb,
          Tag
			FROM
				MemberTagAssignments
          LEFT JOIN MemberTags ON MemberTagAssignments.IDMemberTag = MemberTags.IDMemberTag
        WHERE IDMemb = :memberId
			`;
  const params = {
    memberId: memberId,
  };
  const [memberTagAssignments] = await Conn.wExecPrep(sql, params);
  return memberTagAssignments;
}

export async function queryAllMemberTagAssignments() {
  const sql = `
			SELECT
				MemberTagAssignments.IDMemberTagAssignment,
				MemberTagAssignments.IDMemberTag,
				MemberTagAssignments.IDMemb,
				MemberTags.Tag
			FROM
				MemberTagAssignments
			LEFT JOIN MemberTags ON MemberTagAssignments.IDMemberTag = MemberTags.IDMemberTag
			`;
  const [memberTagAssignments] = await Conn.wExecPrep(sql, {});
  return memberTagAssignments;
}

export async function queryDistinguishedMembers() {
  const sql = `
			SELECT
				Memb.IDMemb,
				Memb.Name1First,
				Memb.Name1Last,
				Memb.Name2First,
				Memb.Name2Last,
				Memb.NameBus,
				GROUP_CONCAT(DISTINCT MTAll.Tag ORDER BY MTAll.Tag SEPARATOR '||') AS Tags
			FROM
				Memb
			JOIN MemberTagAssignments AS MTAFilter ON (MTAFilter.IDMemb = Memb.IDMemb)
			JOIN MemberTags AS MTFilter ON (MTFilter.IDMemberTag = MTAFilter.IDMemberTag)
			LEFT JOIN MemberTagAssignments AS MTAAll ON (MTAAll.IDMemb = Memb.IDMemb)
			LEFT JOIN MemberTags AS MTAll ON (MTAll.IDMemberTag = MTAAll.IDMemberTag)
			WHERE LOWER(MTFilter.Tag) IN (
				:tagFarmersFriend,
				:tagSustainabilitySteward,
				:tagSustainingSteward,
				:tagCommunityCultivator
			)
			GROUP BY
				Memb.IDMemb,
				Memb.Name1First,
				Memb.Name1Last,
				Memb.Name2First,
				Memb.Name2Last,
				Memb.NameBus
			`;

  const params = {
    tagFarmersFriend: "farmers friend",
    tagSustainabilitySteward: "sustainability steward",
    tagSustainingSteward: "sustaining steward",
    tagCommunityCultivator: "community cultivator",
  };

  const [rows] = await Conn.wExecPrep(sql, params);
  return rows;
}
export async function queryMemberTagAssignmentCountByTagName() {
  const sql = `
			SELECT
				MemberTags.IDMemberTag,
				Tag,
				COUNT(*) AS Count
			FROM
				MemberTagAssignments
			  LEFT JOIN MemberTags ON MemberTagAssignments.IDMemberTag = MemberTags.IDMemberTag
			GROUP BY
				MemberTags.IDMemberTag,
				MemberTags.Tag
			ORDER BY
				MemberTags.Tag
			`;
  const [rows] = await Conn.wExecPrep(sql, {});
  if (rows.length > 0) {
    return rows;
  } else {
    const sql2 = `
			SELECT
				IDMemberTag,
				Tag,
				0 AS Count
			FROM
			  MemberTags
			`;
    const [emptyMemberTags] = await Conn.wExecPrep(sql2, {});
    return emptyMemberTags;
  }
}
