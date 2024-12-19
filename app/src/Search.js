// Search.js
// =========
// Database Search Module
// @module Search
// @requires node-mysql2
// @note String values in query placeholders are automatically quoted by mysql2

import {
  EscLike,
  Conn,
  wFeeMembNextFromIDMemb,
  wDataPromMemb,
  wQtyPromProducer,
  CdsAttrProduct,
  SQLBool,
  FldsProduct,
  FldsVty,
} from "./Db.js";
import { Plural, Props, DiffDays, Add_FullPriceToVtyMutate } from "./Util.js";
import { CtResultSearchListPage, CtProductPage } from "../Cfg.js";

import { escape } from "mysql2";

import _ from "lodash";
const { capitalize } = _;

/** Parameter filtering utility
 *  @param {Object} aSrc - Source object containing parameters
 *  @param {Array<string>} aNames - Parameter names to extract
 *  @returns {Object} Filtered parameters with normalized boolean values
 */
function Filter_Params(aSrc, aNames) {
  const oData = {};
  for (const oName of aNames) {
    let oVal = aSrc[oName];
    // Be sure to allow 'false' values through:
    if (oVal === undefined || oVal === "") continue;
    if (oVal === "on") oVal = true;
    oData[oName] = oVal;
  }
  return oData;
}

/** Query string builder for pagination
 *  @param {string} aPathBase - Base URL path
 *  @param {Object} aParams - Request parameters (body or query)
 *  @param {Array<string>} aNamesParam - Allowed parameter names
 *  @param {number} [aIdxPage] - Page index for pagination
 *  @returns {string} URL with query parameters
 */
export function PathQuery(aPathBase, aParams, aNamesParam, aIdxPage) {
  let oPath = aPathBase;

  // Should 'off' checkboxes be explicitly set to 'false'?: [TO DO]
  const oParams = Filter_Params(aParams, aNamesParam);

  // If the index is undefined or zero, skip it. If no index is specified in the
  // query, the first page will be displayed:
  if (aIdxPage) oParams.IdxPage = aIdxPage;

  const oQuery = new URLSearchParams(oParams).toString();
  if (oQuery) oPath += `?${oQuery}`;
  return oPath;
}

/** Pagination metadata generator
 *  @param {Object} aParams - Search parameters
 *  @param {number} aCtRec - Total record count
 *  @param {number} aCtPage - Records per page
 *  @param {Function} [aNameEl] - Element name formatter
 *  @returns {Object} Pagination metadata with prev/next indices and description
 */
export function DataPage(aParams, aCtRec, aCtPage, aNameEl) {
  if (aNameEl === undefined) aNameEl = aCt => Plural(aCt, "match", "matches");

  if (aCtRec <= aCtPage) {
    const oText = aCtRec ? `${aCtRec} ${aNameEl(aCtRec)} found` : `No ${aNameEl(2)} found`;
    return {
      IdxPagePrev: undefined,
      IdxPageNext: undefined,
      Text: oText,
    };
  }

  const oIdxPage = parseInt(aParams.IdxPage) || 0;
  const oNumRecStart = oIdxPage * aCtPage + 1;
  const oNumRecEnd = Math.min((oIdxPage + 1) * aCtPage, aCtRec);
  return {
    IdxPagePrev: oIdxPage > 0 ? oIdxPage - 1 : undefined,
    IdxPageNext: oNumRecEnd < aCtRec ? oIdxPage + 1 : undefined,
    Text: capitalize(`${aNameEl(2)} ${oNumRecStart} - ${oNumRecEnd} of ${aCtRec} total`),
  };
}

/** Exact match ranking expression generator
 *  @param {Object} aParams - Search parameters
 *  @param {string} aNameParam - Parameter name
 *  @param {string} [aNameFld] - Field name (defaults to parameter name)
 *  @returns {Array<string>} SQL rank expressions for exact matches
 */
function MatchExact(aParams, aNameParam, aNameFld) {
  if (aNameFld === undefined) aNameFld = aNameParam;

  if (aParams[aNameParam] === undefined) return [];

  // These are not user-entered values:
  return [`IF(${aNameFld} = :${aNameParam}, 10, 0)`];
}

/** Approximate match ranking expression generator
 *  @param {Object} aParams - Search parameters
 *  @param {string} aNameParam - Parameter name
 *  @param {string} [aNameFld] - Field name (defaults to parameter name)
 *  @returns {Array<string>} SQL rank expressions for approximate matches
 */
function MatchApprox(aParams, aNameParam, aNameFld) {
  if (aNameFld === undefined) aNameFld = aNameParam;

  const oParam = aParams[aNameParam];
  if (oParam === undefined) return [];

  // Neither aNameParam nor aNameFld are user-entered:
  const oSQLs = [
    // This brings exact matches to the front. Otherwise, two near matches
    // (often produced when searching on a last name, since many accounts will
    // have the same value in Name1Last and Name2Last) will have the same score
    // as a single exact match:
    `IF(${aNameFld} = ${escape(oParam)}, 10, 0)`,
    `IF(${aNameFld} LIKE ${EscLike(oParam)}, 5, 0)`,
    `IF(${aNameFld} SOUNDS LIKE :${aNameParam}, 5, 0)`,
  ];
  return oSQLs;
}

/** Name field matching expression generator
 *  @param {Object} aParams - Search parameters
 *  @param {number} aNumName - Number of name fields
 *  @param {number} aWgt - Match weight
 *  @returns {Array<string>} SQL rank expressions for name field matches
 */
function MatchNames(aParams, aNumName, aWgt) {
  // The MatchApprox criteria will work if only one half is provided:
  if (aParams.NameFirst === undefined || aParams.NameLast === undefined) return [];

  const oNameFldFirst = `Name${aNumName}First`;
  const oNameFldLast = `Name${aNumName}Last`;

  const oSQL = `((
			IF(${oNameFldFirst} LIKE ${EscLike(aParams.NameFirst)}, 0.5, 0)
			+ IF(${oNameFldFirst} SOUNDS LIKE ${escape(aParams.NameFirst)}, 0.5, 0)
		)
		*
		(
			IF(${oNameFldLast} LIKE ${EscLike(aParams.NameLast)}, 0.5, 0)
			+ IF(${oNameFldLast} SOUNDS LIKE ${escape(aParams.NameLast)}, 0.5, 0)
		)) * ${aWgt}`;
  return [oSQL];
}

export const NamesParamMemb = [
  "IDMemb",
  "NameBus",
  "NameFirst",
  "NameLast",
  "City",
  "St",
  "Zip",
  "CkTrialMemb",
  "CkPendMemb",
  "CkPendEBT",
  "CkPendVolun",
  "CkWithItsCart",
  "CkDelivHomeNoDist",
  "CkBalPos",
  "CkBalNeg",
  "CkEBT",
  "CkProducer",
  "CkStaff",
  "CkWholesale",
];

/** Member search results
 *  @param {Object} aParams - Search parameters
 *  @param {boolean} aCkExport - Export all records (no pagination)
 *  @returns {Object} Search results with pagination metadata
 */
export async function wMembs(aParams, aCkExport) {
  // These queries won't be fast, but I don't think that matters here.
  //
  // This turns out to be more complex than I expected, and it is difficult to
  // debug. It should be replaced with an all-SQL implementation. [TO DO]
  //
  // Would MATCH/AGAINST be better than LIKE? [TO DO]

  // One query is necessary to get the count, the other to LIMIT the selection:
  let oSQLCt = `SELECT COUNT(*) AS Ct
		FROM (
			SELECT Memb.*,
				Producer.IDProducer, Producer.CdProducer,
				IFNULL(zTransact.BalMoney, 0) AS BalMoney,
				IFNULL(zTransact.BalEBT, 0) AS BalEBT,
				Loc.CdTypeLoc, `;
  // Only a few fields are displayed in the search results. The rest are for the
  // export:
  let oSQLSel = `SELECT Memb.*, Memb.WhenReg as WhenRegMemb,
			Producer.IDProducer, Producer.CdProducer,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT,
			Loc.CdTypeLoc, `;

  /** An array of expressions that contribute to the rank of each search
   *  result. */
  const oRanks = [];
  oRanks.push(...MatchExact(aParams, "IDMemb", "Memb.IDMemb"));
  oRanks.push(...MatchApprox(aParams, "NameBus", "Memb.NameBus"));
  oRanks.push(...MatchApprox(aParams, "NameFirst", "Name1First"));
  oRanks.push(...MatchApprox(aParams, "NameLast", "Name1Last"));
  oRanks.push(...MatchApprox(aParams, "NameFirst", "Name2First"));
  oRanks.push(...MatchApprox(aParams, "NameLast", "Name2Last"));
  // A weight of '80' is just enough to make 'jenn/miller' appear at the top of
  // the search, even though her record is actually 'jennifer/miller'. '40' used
  // to be enough; what happened?:
  oRanks.push(...MatchNames(aParams, 1, 80));
  oRanks.push(...MatchNames(aParams, 2, 40));
  oRanks.push(...MatchApprox(aParams, "City", "Memb.City"));
  oRanks.push(...MatchExact(aParams, "St", "Memb.St"));
  oRanks.push(...MatchExact(aParams, "Zip", "Memb.Zip"));

  let oSQLRanks;
  if (oRanks.length) oSQLRanks = "\n\t" + oRanks.join("\n\t+ ");
  else oSQLRanks = "0";
  oSQLCt += oSQLRanks;
  oSQLSel += oSQLRanks;

  const oFrom = ` AS zRank
		FROM Memb
		LEFT JOIN Producer ON (Producer.IDMemb = Memb.IDMemb)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact ON (zTransact.IDMemb = Memb.IDMemb)
		JOIN Loc ON (Loc.CdLoc = Memb.CdLocLast)`;
  oSQLCt += oFrom;
  oSQLSel += oFrom;

  const oWheres = [];

  if (aParams.CkTrialMemb !== undefined) oWheres.push("CyclesUsed < 2");

  if (aParams.CkPendMemb !== undefined) oWheres.push("CdRegMemb = 'Pend' AND CyclesUsed = 2");

  if (aParams.CkPendEBT !== undefined) oWheres.push("CdRegEBT = 'Pend'");

  if (aParams.CkPendVolun !== undefined) oWheres.push("CdRegVolun = 'Pend'");

  if (aParams.CkWithItsCart !== undefined) {
    const oSQLFilt = `Memb.IDMemb IN (
				SELECT IDMemb
				FROM Cart
				JOIN ItCart USING (IDCart)
				JOIN StApp USING (IDCyc)
			)`;
    oWheres.push(oSQLFilt);
  }

  // Should this use the cart location instead? If not, shouldn't this 'default'
  // location be added to the Member and Member Detail pages, at least when
  // viewed by staff?: [TO DO]
  if (aParams.CkDelivHomeNoDist !== undefined)
    oWheres.push("CdTypeLoc = 'Deliv' AND DistDeliv IS NULL");

  if (aParams.CkBalPos !== undefined) oWheres.push("(BalMoney + BalEBT) > 0.0");

  if (aParams.CkBalNeg !== undefined) oWheres.push("(BalMoney + BalEBT) < 0.0");

  if (aParams.CkEBT !== undefined) oWheres.push("CdRegEBT = 'Approv'");

  if (aParams.CkProducer !== undefined) oWheres.push("IDProducer IS NOT NULL");

  if (aParams.CkStaff !== undefined) oWheres.push("CdStaff != 'NotStaff'");

  if (aParams.CkWholesale !== undefined) oWheres.push("Memb.CdRegWholesale = 'Approv'");

  let oSQLWheres;
  if (oWheres.length) oSQLWheres = "\nWHERE " + oWheres.join("\n\tAND ");
  else oSQLWheres = "";

  oSQLCt += oSQLWheres;
  oSQLSel += oSQLWheres;

  // If there are no rank-producing criteria, all values will be zero:
  if (oRanks.length) {
    oSQLCt += "\nHAVING zRank > 0";
    oSQLSel += "\nHAVING zRank > 0";
  }

  oSQLCt += ") AS Sub";

  oSQLSel += "\nORDER BY zRank DESC, Memb.IDMemb DESC";

  if (!aCkExport) {
    const oIdxStart = (aParams.IdxPage || 0) * CtResultSearchListPage;
    oSQLSel += `\nLIMIT ${oIdxStart}, ${CtResultSearchListPage}`;
  }

  const [oRowsCt] = await Conn.wExec(oSQLCt, aParams);
  if (oRowsCt.length < 1) throw Error("Search wMembs: Cannot get count");

  const [oRowsSel] = await Conn.wExec(oSQLSel, aParams);

  // It's lame to do this here, but these are needed by the Member Detail
  // dialogs. Formalize the member data in a class? Maybe the balance could be
  // queried there as well: [TO DO]
  const oTasksEl = oRowsSel.map(async o => {
    o.FeeMembNext = await wFeeMembNextFromIDMemb(o.IDMemb);

    const oDataProm = await wDataPromMemb(o.IDMemb);
    o.IDCart = oDataProm.IDCart;
    o.QtyProm = oDataProm.QtyProm;
  });
  await Promise.all(oTasksEl);

  return {
    Ct: oRowsCt[0].Ct,
    Membs: oRowsSel,
  };
}

export const NamesParamProducer = [
  "IDProducer",
  "CdProducer",
  "NameBus",
  "NameFirst",
  "NameLast",
  "CkPendProducer",
  "CkList",
  "CkWithSale",
  "CkIsWholesale",
];

/** Producer search results
 *  @param {Object} aParams - Search parameters
 *  @param {boolean} aCkExport - Export all records (no pagination)
 *  @returns {Object} Search results with pagination metadata
 */
export async function wProducers(aParams, aCkExport) {
  // These queries won't be fast, but I don't think that matters here.
  //
  // This turns out to be more complex than I expected, and it is difficult to
  // debug. It should be replaced with an all-SQL implementation. [TO DO]
  //
  // Would MATCH/AGAINST be better than LIKE? [TO DO]

  // Build SQL
  // ---------

  // One query is necessary to get the count, the other to LIMIT the selection:
  let oSQLCt = `SELECT COUNT(*) AS Ct FROM (SELECT Producer.*,
			Memb.NameLogin, Memb.Name1First, Memb.Name1Last,
			Memb.Name2First, Memb.Name2Last,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT, `;
  // Only a few fields are displayed in the search results. The rest are for the
  // export:
  let oSQLSel = `SELECT Producer.*, Producer.WhenReg AS WhenRegProducer,
			Memb.NameLogin, Memb.Name1First, Memb.Name1Last,
			Memb.Name2First, Memb.Name2Last,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT, `;

  /** An array of expressions that contribute to the rank of each search
   *  result. */
  const oRanks = [];
  oRanks.push(...MatchExact(aParams, "IDProducer"));
  oRanks.push(...MatchApprox(aParams, "CdProducer"));
  oRanks.push(...MatchApprox(aParams, "NameBus", "Producer.NameBus"));
  oRanks.push(...MatchApprox(aParams, "NameFirst", "Name1First"));
  oRanks.push(...MatchApprox(aParams, "NameFirst", "Name2First"));
  oRanks.push(...MatchApprox(aParams, "NameLast", "Name1Last"));
  oRanks.push(...MatchApprox(aParams, "NameLast", "Name2Last"));

  let oSQLRanks;
  if (oRanks.length) oSQLRanks = "\n\t" + oRanks.join("\n\t+ ");
  else oSQLRanks = "0";
  oSQLCt += oSQLRanks;
  oSQLSel += oSQLRanks;

  const oFrom = ` AS zRank
		FROM Producer
		JOIN Memb ON (Memb.IDMemb = Producer.IDMemb)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact ON (zTransact.IDMemb = Memb.IDMemb)`;
  oSQLCt += oFrom;
  oSQLSel += oFrom;

  const oWheres = [];

  if (aParams.CkPendProducer !== undefined) oWheres.push("CdRegProducer = 'Pend'");

  if (aParams.CkWithSale !== undefined) {
    const oSQLFilt = `Producer.IDProducer IN (
				SELECT IDProducer
				FROM Producer
				JOIN Product USING (IDProducer)
				JOIN Vty USING (IDProduct)
				JOIN ItCart USING (IDVty)
				JOIN Cart USING (IDCart)
				JOIN StApp USING (IDCyc)
			)`;
    oWheres.push(oSQLFilt);
  }

  if (aParams.CkList !== undefined) {
    oWheres.push("CkListProducer = 1");
  }

  if (aParams.CkIsWholesale !== undefined) {
    oWheres.push("Producer.CdRegWholesale = 'Approv'");
  }

  let oSQLWheres;
  if (oWheres.length) oSQLWheres = "\nWHERE " + oWheres.join("\n\tAND ");
  else oSQLWheres = "";
  oSQLCt += oSQLWheres;
  oSQLSel += oSQLWheres;

  // If there are no rank-producing criteria, all values will be zero:
  if (oRanks.length) {
    oSQLCt += "\nHAVING zRank > 0";
    oSQLSel += "\nHAVING zRank > 0";
  }

  oSQLCt += ") AS Sub";

  oSQLSel += "\nORDER BY zRank DESC, IDProducer DESC";

  if (!aCkExport) {
    const oIdxStart = (aParams.IdxPage || 0) * CtResultSearchListPage;
    oSQLSel += `\nLIMIT ${oIdxStart}, ${CtResultSearchListPage}`;
  }

  // Run queries
  // -----------

  const [oRowsCt] = await Conn.wExec(oSQLCt, aParams);
  if (oRowsCt.length < 1) throw Error("Search wProducers: Cannot get count");

  const [oRowsSel] = await Conn.wExec(oSQLSel, aParams);

  // It's lame to do this here, but these are needed by the Producer Detail
  // dialogs. See the member search for a similar problem: [TO DO]
  const oTasksEl = oRowsSel.map(async o => {
    o.QtyProm = await wQtyPromProducer(o.IDProducer);
  });
  await Promise.all(oTasksEl);

  return {
    Ct: oRowsCt[0].Ct,
    Producers: oRowsSel,
  };
}

export const NamesParamTransact = [
  "IDTransact",
  "IDMemb",
  "IDProducer",
  "CdTypeTransact",
  "CdMethPay",
  "WhenStart",
  "WhenEnd",
];

/** Transaction search results
 *  @param {Object} aParams - Search parameters
 *  @param {boolean} aCkExport - Export all records (no pagination)
 *  @returns {Object} Search results with pagination metadata
 */
export async function wTransacts(aParams, aCkExport) {
  // Build SQL
  // ---------

  // One query is necessary to get the count, the other to LIMIT the selection:
  let oSQLCt = `SELECT COUNT(*) AS Ct FROM (SELECT Transact.*,
			Memb.Name1First, Memb.Name1Last,
			Producer.NameBus AS NameBusProducer,
			MembCreate.Name1First AS Name1FirstCreate,
			MembCreate.Name1Last AS Name1LastCreate,`;
  // Only a few fields are displayed in the search results. The rest are for the
  // export:
  let oSQLSel = `SELECT Transact.*,
			Memb.Name1First, Memb.Name1Last,
			Producer.NameBus AS NameBusProducer,
			MembCreate.Name1First AS Name1FirstCreate,
			MembCreate.Name1Last AS Name1LastCreate,`;

  /** An array of expressions that contribute to the rank of each search
   *  result. */
  const oRanks = [];

  // 'Rank' search produce 'union' results, which don't seem useful for
  // transactions.

  let oSQLRanks;
  if (oRanks.length) oSQLRanks = "\n\t" + oRanks.join("\n\t+ ");
  else oSQLRanks = "0";
  oSQLCt += oSQLRanks;
  oSQLSel += oSQLRanks;

  const oFrom =
    "\n\tAS zRank\nFROM Transact" +
    "\nLEFT JOIN Memb ON Memb.IDMemb = Transact.IDMemb" +
    "\nLEFT JOIN Memb AS MembCreate ON MembCreate.IDMemb = Transact.IDMembStaffCreate" +
    "\nLEFT JOIN Producer ON Producer.IDProducer = Transact.IDProducer";
  oSQLCt += oFrom;
  oSQLSel += oFrom;

  const oWheres = [];

  if (aParams.IDTransact !== undefined) oWheres.push(`IDTransact = ${escape(aParams.IDTransact)}`);

  if (aParams.IDMemb !== undefined) oWheres.push(`Transact.IDMemb = ${escape(aParams.IDMemb)}`);

  if (aParams.IDProducer !== undefined)
    oWheres.push(`Transact.IDProducer = ${escape(aParams.IDProducer)}`);

  if (aParams.CdTypeTransact !== undefined)
    oWheres.push(`CdTypeTransact = ${escape(aParams.CdTypeTransact)}`);

  if (aParams.CdMethPay !== undefined) oWheres.push(`CdMethPay = ${escape(aParams.CdMethPay)}`);

  if (aParams.WhenStart !== undefined)
    oWheres.push(`WhenCreate >= '${aParams.WhenStart.toISOString()}'`);

  if (aParams.WhenEnd !== undefined) {
    const oWhenNext = new Date(aParams.WhenEnd.getTime());
    oWhenNext.setDate(oWhenNext.getDate() + 1);
    oWheres.push(`WhenCreate < '${oWhenNext.toISOString()}'`);
  }

  let oSQLWheres;
  if (oWheres.length) oSQLWheres = "\nWHERE " + oWheres.join("\n\tAND ");
  else oSQLWheres = "";
  oSQLCt += oSQLWheres;
  oSQLSel += oSQLWheres;

  // If there are no rank-producing criteria, all values will be zero:
  if (oRanks.length) {
    oSQLCt += "\nHAVING zRank > 0";
    oSQLSel += "\nHAVING zRank > 0";
  }

  oSQLCt += ") AS Sub";

  oSQLSel += "\nORDER BY zRank DESC, IDTransact DESC";

  if (!aCkExport) {
    const oIdxStart = (aParams.IdxPage || 0) * CtResultSearchListPage;
    oSQLSel += `\nLIMIT ${oIdxStart}, ${CtResultSearchListPage}`;
  }

  // Run queries
  // -----------

  const [oRowsCt] = await Conn.wExec(oSQLCt, aParams);
  if (oRowsCt.length < 1) throw Error("Search wTransacts: Cannot get count");

  const [oRowsSel] = await Conn.wExec(oSQLSel, aParams);

  return {
    Ct: oRowsCt[0].Ct,
    Transacts: oRowsSel,
  };
}

// --------------
// Product search
// --------------

function NamesParamAttrProduct() {
  const oNames = [];
  for (const oName in CdsAttrProduct) oNames.push("Ck" + oName);
  return oNames;
}

export const NamesParamProduct = [
  "Terms",
  "IDCat",
  "IDSubcat",
  "IDProducer",
  "CkPast",
  ...NamesParamAttrProduct(),
];

function SQLSelProducts(
  aSQLScore,
  aSQLJoin,
  aSQLWhere,
  hasAlsoTerms = false,
  optionalTerms = null,
) {
  // This query uses an aggregation of variety data (among other things) to
  // filter, sort, and limit product records, then it joins the variety table to
  // the result so that variety record sets are returned in product groups with
  // the desired order. This ends up selecting varieties that do not meet the
  // search criteria (if sibling varieties do meet them) but I think that is
  // okay. Note that the product limit (and therefore the product sort) must
  // occur within the subquery. That same sorting must be repeated outside the
  // subquery to sort the joined varieties. In particular, the varieties must be
  // sorted by product, or they will be 'split' into separate cards within the
  // results:
  if (hasAlsoTerms) {
    return `
		SELECT zProductAvail.*,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkListWeb, Vty.CkListOnsite, Vty.PriceNomWeb, Vty.QtyOffer,
			IFNULL(zItCartVty.QtyProm, 0) AS QtyProm
		FROM (
			SELECT Product.*, ${aSQLScore} AS Score,
				SUM(Vty.QtyOffer) AS QtyOfferWebProduct,
				IFNULL(zItCartProduct.QtyProm, 0) AS QtyPromWebProduct,
				Producer.CdProducer, Producer.NameBus, Producer.NameImgProducer,
				Subcat.NameSubcat,
				Cat.IDCat, Cat.NameCat
			FROM Product
			JOIN Vty USING (IDProduct)
			JOIN Producer USING (IDProducer)
			JOIN Subcat USING (IDSubcat)
			JOIN Cat USING (IDCat)
			LEFT JOIN (
				SELECT Product.IDProduct, SUM(ItCart.QtyProm) AS QtyProm
				FROM Product
				JOIN Vty USING (IDProduct)
				JOIN ItCart USING (IDVty)
				JOIN Cart USING (IDCart)
				JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
				GROUP BY Product.IDProduct
			) AS zItCartProduct USING (IDProduct)
			${aSQLJoin}
			WHERE ${aSQLWhere}
				AND (Producer.CdRegProducer = 'Approv')
				AND (Producer.CkListProducer IS TRUE)
				AND (Vty.CkListWeb IS TRUE)
				AND (Vty.QtyOffer > 0)
				AND (Product.NameProduct LIKE '%${optionalTerms}%')
			GROUP BY Product.IDProduct
			ORDER BY Score DESC, Product.WhenCreate DESC, Product.IDProduct DESC
			LIMIT :IdxStart, :CtPage
		) AS zProductAvail
		JOIN Vty USING (IDProduct)
		LEFT JOIN (
			SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
			FROM Vty
			JOIN ItCart USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY Vty.IDVty
		) AS zItCartVty USING (IDVty)
		WHERE Vty.CkListWeb IS TRUE
		ORDER BY zProductAvail.Score DESC, zProductAvail.WhenCreate DESC,
			zProductAvail.IDProduct, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax`;
  } else {
    return `
		SELECT zProductAvail.*,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkListWeb, Vty.CkListOnsite, Vty.PriceNomWeb, Vty.QtyOffer,
			IFNULL(zItCartVty.QtyProm, 0) AS QtyProm
		FROM (
			SELECT Product.*, ${aSQLScore} AS Score,
				SUM(Vty.QtyOffer) AS QtyOfferWebProduct,
				IFNULL(zItCartProduct.QtyProm, 0) AS QtyPromWebProduct,
				Producer.CdProducer, Producer.NameBus, Producer.NameImgProducer,
				Subcat.NameSubcat,
				Cat.IDCat, Cat.NameCat
			FROM Product
			JOIN Vty USING (IDProduct)
			JOIN Producer USING (IDProducer)
			JOIN Subcat USING (IDSubcat)
			JOIN Cat USING (IDCat)
			LEFT JOIN (
				SELECT Product.IDProduct, SUM(ItCart.QtyProm) AS QtyProm
				FROM Product
				JOIN Vty USING (IDProduct)
				JOIN ItCart USING (IDVty)
				JOIN Cart USING (IDCart)
				JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
				GROUP BY Product.IDProduct
			) AS zItCartProduct USING (IDProduct)
			${aSQLJoin}
			WHERE ${aSQLWhere}
				AND (Producer.CdRegProducer = 'Approv')
				AND (Producer.CkListProducer IS TRUE)
				AND (Vty.CkListWeb IS TRUE)
				AND (Vty.QtyOffer > 0)
			GROUP BY Product.IDProduct
			ORDER BY Score DESC, Product.WhenCreate DESC, Product.IDProduct DESC
			LIMIT :IdxStart, :CtPage
		) AS zProductAvail
		JOIN Vty USING (IDProduct)
		LEFT JOIN (
			SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
			FROM Vty
			JOIN ItCart USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY Vty.IDVty
		) AS zItCartVty USING (IDVty)
		WHERE Vty.CkListWeb IS TRUE
		ORDER BY zProductAvail.Score DESC, zProductAvail.WhenCreate DESC,
			zProductAvail.IDProduct, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax`;
  }
}

function SQLCtProducts(aSQLJoin, aSQLWhere, hasTerms = false, optionalTerms = null) {
  if (hasTerms) {
    return `
		SELECT COUNT(*) AS Ct
		FROM (
			SELECT Product.IDProduct
			FROM Product
			JOIN Vty USING (IDProduct)
			JOIN Producer USING (IDProducer)
			JOIN Subcat USING (IDSubcat)
			JOIN Cat USING (IDCat)
			${aSQLJoin}
			WHERE ${aSQLWhere}
				AND (Producer.CdRegProducer = 'Approv')
				AND (Producer.CkListProducer IS TRUE)
				AND (Vty.CkListWeb IS TRUE)
				AND (Vty.QtyOffer > 0)
				AND (Product.NameProduct LIKE '%${optionalTerms}%')
			GROUP BY Product.IDProduct
		) AS zProductAvail`;
  } else {
    return `
		SELECT COUNT(*) AS Ct
		FROM (
			SELECT Product.IDProduct
			FROM Product
			JOIN Vty USING (IDProduct)
			JOIN Producer USING (IDProducer)
			JOIN Subcat USING (IDSubcat)
			JOIN Cat USING (IDCat)
			${aSQLJoin}
			WHERE ${aSQLWhere}
				AND (Producer.CdRegProducer = 'Approv')
				AND (Producer.CkListProducer IS TRUE)
				AND (Vty.CkListWeb IS TRUE)
				AND (Vty.QtyOffer > 0)
			GROUP BY Product.IDProduct
		) AS zProductAvail`;
  }
}

const oSQLScoreDef = "IF(SUM(Vty.QtyOffer) > IFNULL(zItCartProduct.QtyProm, 0), 1, 0)";

function QrysProductNew(_aParams) {
  const oSQLScore = oSQLScoreDef;
  const oSQLWhere = "Product.WhenCreate > (NOW() - INTERVAL 30 DAY)";

  const oSQLSel = SQLSelProducts(oSQLScore, "", oSQLWhere);
  const oSQLCt = SQLCtProducts("", oSQLWhere);

  const oParamsEx = {};

  return [oSQLCt, oSQLSel, oParamsEx];
}

function QrysProductTerms(aParams) {
  //The function that's used to search terms and return products
  const oSQLScore = `MAX(
			(IF((Product.IDProduct = :Terms), 20, 0)
			+ IF((Vty.IDVty = :Terms), 20, 0)
			+ (MATCH(Product.NameProduct) AGAINST(:Terms)) * 20
			+ (MATCH(Product.Descrip) AGAINST(:Terms)) * 3
			+ (MATCH(Vty.Size, Vty.Kind) AGAINST(:Terms) * 5)
			+ (MATCH(Producer.NameBus) AGAINST(:Terms) * 10)
			+ (MATCH(Subcat.NameSubcat) AGAINST(:Terms) * 8)
			+ (MATCH(Cat.NameCat) AGAINST(:Terms) * 8)

			+ (MATCH(Product.NameProduct) AGAINST(:TermsFlip)) * 10
			+ (MATCH(Product.Descrip) AGAINST(:TermsFlip)) * 1.5
			+ (MATCH(Vty.Size, Vty.Kind) AGAINST(:TermsFlip) * 2.5)
			+ (MATCH(Producer.NameBus) AGAINST(:TermsFlip) * 1.5)
			+ (MATCH(Subcat.NameSubcat) AGAINST(:TermsFlip) * 4)
			+ (MATCH(Cat.NameCat) AGAINST(:TermsFlip) * 4))

			* IF((Vty.QtyOffer > IFNULL(zItCartProduct.QtyProm, 0)), 1.0, 0.5)
		)`;
  const oSQLWhere = `((Product.IDProduct = :Terms)
			OR (Vty.IDVty = :Terms)
			OR MATCH(Product.NameProduct) AGAINST(:Terms)
			OR MATCH(Product.Descrip) AGAINST(:Terms)
			OR (
				MATCH(Vty.Size, Vty.Kind) AGAINST(:Terms)
				AND Vty.QtyOffer > 0
			)
			OR MATCH(Producer.NameBus) AGAINST(:Terms)
			OR MATCH(Subcat.NameSubcat) AGAINST(:Terms)
			OR MATCH(Cat.NameCat) AGAINST(:Terms)

			OR MATCH(Product.NameProduct) AGAINST(:TermsFlip)
			OR MATCH(Product.Descrip) AGAINST(:TermsFlip)
			OR (
				MATCH(Vty.Size, Vty.Kind) AGAINST(:TermsFlip)
				AND Vty.QtyOffer > 0
			)
			OR MATCH(Producer.NameBus) AGAINST(:TermsFlip)
			OR MATCH(Subcat.NameSubcat) AGAINST(:TermsFlip)
			OR MATCH(Cat.NameCat) AGAINST(:TermsFlip))`;

  const oSQLSel = SQLSelProducts(oSQLScore, "", oSQLWhere);
  const oSQLCt = SQLCtProducts("", oSQLWhere);

  const oTerms = aParams.Terms || "";
  // Repeat the search terms with each crudely changed to or from plural form by
  // adding or removing 's'. This ensures that 'carrot' returns actual carrots
  // (rather than just items that contain 'carrot'), and 'breads' returns bread:
  const oTermsFlip = oTerms
    .toLowerCase()
    .split(" ")
    .map(o => (o.endsWith("s") ? o.substr(o, o.length - 1) : o + "s"))
    .join(" ");

  const oParamsEx = {
    Terms: oTerms,
    TermsFlip: oTermsFlip,
  };

  return [oSQLCt, oSQLSel, oParamsEx];
}

function QrysProductCat(aParams) {
  const oSQLScore = oSQLScoreDef;
  const oSQLWhere = "Cat.IDCat = :IDCat";

  const oSQLSel = SQLSelProducts(oSQLScore, "", oSQLWhere);
  const oSQLCt = SQLCtProducts("", oSQLWhere);

  const oParamsEx = {
    IDCat: aParams.IDCat,
  };

  return [oSQLCt, oSQLSel, oParamsEx];
}

function QrysProductSubcat(aParams) {
  const oSQLScore = oSQLScoreDef;
  const oSQLWhere = "Subcat.IDSubcat = :IDSubcat";

  const oSQLSel = SQLSelProducts(oSQLScore, "", oSQLWhere);
  const oSQLCt = SQLCtProducts("", oSQLWhere);

  const oParamsEx = {
    IDSubcat: aParams.IDSubcat,
  };

  return [oSQLCt, oSQLSel, oParamsEx];
}

function QrysProductProducer(aParams) {
  const oSQLScore = oSQLScoreDef;
  const oSQLWhere = "Producer.IDProducer = :IDProducer";

  const oSQLSel = SQLSelProducts(oSQLScore, "", oSQLWhere);
  const oSQLCt = SQLCtProducts("", oSQLWhere);

  const oParamsEx = {
    IDProducer: aParams.IDProducer,
  };

  return [oSQLCt, oSQLSel, oParamsEx];
}

function QrysProductPast(aParams) {
  // The cycle ID provides an easy way to favor recent orders:
  const oSQLScore = `SUM(Cart.IDCyc * IF((Vty.QtyOffer > IFNULL(zItCartProduct.QtyProm, 0)), 1, 0.5))`;
  const oSQLJoin = `JOIN ItCart USING (IDVty)
		JOIN Cart USING (IDCart)`;
  const oSQLWhere = "Cart.IDMemb = :IDMemb";

  const oSQLSel = SQLSelProducts(oSQLScore, oSQLJoin, oSQLWhere);
  const oSQLCt = SQLCtProducts(oSQLJoin, oSQLWhere);

  const oParamsEx = {
    IDMemb: aParams.IDMemb,
  };

  return [oSQLCt, oSQLSel, oParamsEx];
}

/** Returns 'true' if the specified query parameters specify any product
 *  attribute. */
function CkAttrsProduct(aParams) {
  for (const oName in CdsAttrProduct) if (aParams["Ck" + oName] !== undefined) return true;
  return false;
}

/** Returns selection and count SQL for a product attribute search. For the time
 *  being, multiple attribute criteria are joined by 'OR'. */
function QrysProductAttr(aParams, hasAlsoTerms = false, optionalTerms = null) {
  const oSQLScore = oSQLScoreDef;

  const oAttrs = [];
  for (const oName in CdsAttrProduct) {
    const oVal = aParams["Ck" + oName];
    if (oVal !== undefined) {
      oAttrs.push({ Name: oName, Val: SQLBool(oVal) });

      // Expand 'vegetarian' search:
      if (oName === "Veget") oAttrs.push({ Name: "Vegan", Val: SQLBool(oVal) });
      // Expand 'naturally-grown' search:
      if (oName === "NaturGrownSelf") oAttrs.push({ Name: "NaturGrownCert", Val: SQLBool(oVal) });
    }
  }

  const oSQLWhere =
    "(" + oAttrs.map(aAttr => `Product.CkAttr${aAttr.Name} = ${aAttr.Val}`).join(" OR ") + ")";

  let oSQLSel = null;
  let oSQLCt = null;
  if (hasAlsoTerms) {
    oSQLSel = SQLSelProducts(oSQLScore, "", oSQLWhere, hasAlsoTerms, optionalTerms);
    oSQLCt = SQLCtProducts("", oSQLWhere, hasAlsoTerms, optionalTerms);
  } else {
    oSQLSel = SQLSelProducts(oSQLScore, "", oSQLWhere);
    oSQLCt = SQLCtProducts("", oSQLWhere);
  }

  const oParamsEx = {};

  return [oSQLCt, oSQLSel, oParamsEx];
}

export async function wProducts(aParams, aIsMembEbtEligible) {
  let hasTerms = false;
  let termsToSearch = "";
  let [oSQLCt, oSQLSel, oParamsEx] = [null, null, null];
  if (aParams.Terms) {
    hasTerms = true;
    termsToSearch = aParams.Terms;
    if (aParams.Terms.toLowerCase().endsWith("s")) {
      termsToSearch = aParams.Terms.slice(0, -1);
    }
    // Asterisk replace is a hack here to make mysql happy.
    aParams.Terms = aParams.Terms.replace("*", "");
  }
  if (aParams.IDCat) [oSQLCt, oSQLSel, oParamsEx] = QrysProductCat(aParams);
  else if (aParams.IDSubcat) [oSQLCt, oSQLSel, oParamsEx] = QrysProductSubcat(aParams);
  else if (aParams.IDProducer) [oSQLCt, oSQLSel, oParamsEx] = QrysProductProducer(aParams);
  else if (CkAttrsProduct(aParams)) {
    if (hasTerms) {
      [oSQLCt, oSQLSel, oParamsEx] = QrysProductAttr(aParams, hasTerms, termsToSearch);
    } else {
      [oSQLCt, oSQLSel, oParamsEx] = QrysProductAttr(aParams);
    }
  } else if (aParams.CkPast) [oSQLCt, oSQLSel, oParamsEx] = QrysProductPast(aParams);
  else {
    if (hasTerms) {
      [oSQLCt, oSQLSel, oParamsEx] = QrysProductTerms(aParams);
    } else {
      [oSQLCt, oSQLSel, oParamsEx] = QrysProductNew(aParams);
    }
  }

  // eslint-disable-next-line
  if ([oSQLCt, oSQLSel, oParamsEx] == [null, null, null])
    throw Error("Search wProducts: Invalid search");

  // Run queries
  // -----------

  const oParams = {
    ...oParamsEx,
    IdxStart: (aParams.IdxPage || 0) * CtProductPage,
    CtPage: CtProductPage,
  };

  const [oRowsCt, _oFldsCt] = await Conn.wExecPrep(oSQLCt, oParams); //9/8/22 might need to change query
  if (oRowsCt.length < 1 || oRowsCt[0].Ct === undefined)
    throw Error("Search wProducts: Cannot get count");
  let oCt = oRowsCt[0].Ct;
  console.log("oCt: ", oCt);

  const [oRowsSel, _oFldsSel] = await Conn.wExecPrep(oSQLSel, oParams);

  return {
    Ct: oCt,
    Products: ProductsVtysRoll(oRowsSel, aIsMembEbtEligible),
  };
}

export function ProductsVtysRoll(aRows, aIsMembEbtEligible) {
  const oProducts = [];

  let oProductLast = null;
  const oNow = new Date();
  for (const oRow of aRows) {
    // It would be much better to get the field list from the database. It is
    // too easy to miss new fields here. [TO DO]

    // Add product element:
    if (!oProductLast || oRow.IDProduct !== oProductLast.IDProduct) {
      oProductLast = {
        ...Props(oRow, FldsProduct),

        Score: oRow.Score,
        CkNew: DiffDays(oNow, oRow.WhenCreate) < 30,

        QtyOfferWebProduct: oRow.QtyOfferWebProduct,
        QtyPromWebProduct: oRow.QtyPromWebProduct,

        CdProducer: oRow.CdProducer,
        NameBus: oRow.NameBus,
        NameImgProducer: oRow.NameImgProducer,

        NameSubcat: oRow.NameSubcat,

        IDCat: oRow.IDCat,
        NameCat: oRow.NameCat,

        Vtys: [],
      };
      oProducts.push(oProductLast);
    }

    // Add variety element:
    const oVty = {
      ...Props(oRow, FldsVty),

      QtyProm: oRow.QtyProm,
      CkExcludeConsumerFee: oRow.CkExcludeConsumerFee,
    };
    Add_FullPriceToVtyMutate(oVty, aIsMembEbtEligible);
    oProductLast.Vtys.push(oVty);
  }
  return oProducts;
}
