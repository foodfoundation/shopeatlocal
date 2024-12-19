// Util.js
// =======
// Utilities

import { PhaseCycLess, getProductRow } from "./Db.js";
import { TimeZoneUser, DocumentStoragePrefix } from "../Cfg.js";
import { Locs, Site } from "./Site.js";

import { DateTime } from "luxon";
import { join } from "path";

import lodash from "lodash";
const { round, cloneDeep } = lodash;

// -------
// Objects
// -------

/** Utility Functions Module
 *  @module Util
 *  @requires luxon
 *  @requires lodash
 */

/** Property extraction utility
 *  @param {Object} aSrc - Source object
 *  @param {Array<string>} aNames - Property names to extract
 *  @returns {Object} New object with specified properties
 */
export function Props(aSrc, aNames) {
  const oExtract = {};
  aNames.forEach(oName => {
    const oVal = aSrc[oName];
    if (oVal !== undefined) oExtract[oName] = oVal;
  });
  return oExtract;
}

/** Object property merger
 *  @param {Object} aSrc - Base object
 *  @param {Object} aAdd - Object with properties to merge
 *  @returns {Object} New object with merged properties
 */
export function PropsSum(aSrc, aAdd) {
  const oSum = { ...aSrc };
  Copy_Props(oSum, aAdd);
  return oSum;
}

/** Property difference calculator
 *  @param {Object} aSrc - Source object
 *  @param {Object|string|Array<string>} aExcl - Properties to exclude
 *  @returns {Object} New object without excluded properties
 */
export function PropsDiff(aSrc, aExcl) {
  const oDiff = { ...aSrc };

  if (typeof aExcl === "string") delete oDiff[aExcl];
  else if (Array.isArray(aExcl))
    aExcl.forEach(o => {
      delete oDiff[o];
    });
  else for (const o of aExcl) delete oDiff[o];

  return oDiff;
}

/** Property copy utility
 *  @param {Object} aDest - Destination object
 *  @param {Object} aSrc - Source object
 */
export function Copy_Props(aDest, aSrc) {
  Object.assign(aDest, aSrc);
}

/** Property addition utility
 *  @param {Object} aDest - Destination object
 *  @param {Object} aSrc - Source object
 */
export function Add_Props(aDest, aSrc) {
  for (const oProp in aSrc) {
    if (aDest[oProp] === undefined) aDest[oProp] = aSrc[oProp];
  }
}

/** Empty string nullifier
 *  @param {Object} aObj - Object to process
 *  @returns {Object} Object with empty strings converted to null
 */
export function Null_StrsEmpty(aObj) {
  for (const oProp in aObj) {
    if (aObj[oProp] === "") aObj[oProp] = null;
  }
  return aObj;
}

/** Converts all properties with names that begin with 'Ck' to boolean values.
 *  If a starting value is zero or "false", the property will be set to 'false'.
 *  If it is the empty string (as happens when a flag is specified in a query
 *  string without a value) it will be set to aValEmpty. Otherwise, the property
 *  will be set to 'true'. aValEmpty is 'false' by default.
 */
export function Bool_Cks(aObj, aValEmpty) {
  // It is perhaps useful to interpret the presence of a property in a query
  // string as 'true' if no value is provided. In most cases, though, it seems
  // like the empty string should be 'false':
  if (aValEmpty === undefined) aValEmpty = false;

  for (const oName in aObj)
    if (oName.startsWith("Ck")) {
      let oVal = aObj[oName].toLowerCase();
      switch (oVal) {
        case "":
          oVal = aValEmpty;
          break;

        case "0":
        case "false":
        // In case the data is processed twice:
        case false:
        // Just in case:
        case undefined:
        case null:
          oVal = false;
          break;

        default:
          oVal = true;
          break;
      }
      aObj[oName] = oVal;
    }
}

/** Replaces properties in the specified object with Excel-compatible values. */
export function Fmt_RowExcel(aRow) {
  for (const oName in aRow) {
    const oVal = aRow[oName];
    if (oVal === undefined || oVal === null) continue;

    let oText;
    if (oName.startsWith("Ck")) oText = TextBool(oVal);
    else if (oName.startsWith("When")) oText = TextDateTimeExcel(oVal);
    else if (oName.startsWith("Price") || oName.startsWith("Sales")) oText = TextCurr(oVal);
    else if (oName.startsWith("IDCat")) oText = TextIDCat(oVal);
    else if (oName.startsWith("IDSubcat")) oText = TextIDSubcat(oVal);
    else if (oName.startsWith("IDCyc")) oText = TextIDCyc(oVal);
    else if (oName.startsWith("IDCart")) oText = TextIDCart(oVal);
    else if (oName.startsWith("IDMemb")) oText = TextIDMemb(oVal);
    else if (oName.startsWith("IDProducer")) oText = TextIDProducer(oVal);
    else if (oName.startsWith("IDProduct")) oText = TextIDProduct(oVal);
    else if (oName.startsWith("IDVty")) oText = TextIDVty(oVal);
    else if (oName.startsWith("IDTransact")) oText = TextIDTransact(oVal);
    else if (oName === "IDInvcProducerWeb") oText = TextIDInvcProducerWeb(oVal);
    else if (oName === "IDInvcProducerOnsite") oText = TextIDInvcProducerOnsite(oVal);
    else if (oName === "IDInvcShopWeb") oText = TextIDInvcShopWeb(oVal);
    else if (oName === "IDInvcShopOnsite") oText = TextIDInvcShopOnsite(oVal);
    // Transact records reference multiple invoice types from the IDInvc field:
    else if (oName === "IDInvc") oText = TextIDInvcTransact(aRow.IDInvc, aRow.CdTypeTransact);
    else if (oName === "CdInvcType") oText = TextIdentity(oVal);
    else if (oName === "CdCartType") oText = TextIdentity(oVal);
    if (oText) aRow[oName] = oText;
  }
}

/** 'Structures' a sequence of 'flat' records into a hierarchy of arbitrary
 *  depth, defined by aSpecs. Each 'level' record in aSpecs must define:
 *
 *  ~ Props: An array of strings naming the fields to be included in this level.
 *
 *  If another level follows that record, these properties should also be
 *  defined:
 *
 *  ~ NameKey: The name of the key field for this level. When this field
 *    changes, a new record will be started.
 *
 *  ~ NameChild: The name of the array that will contain child records.
 *
 *  The flat records must be sorted by the key fields, or the grouping will not
 *  performed correctly. See 'README.md' for more on structuring. */
export function Struct(aElsFlat, aSpecs) {
  // To avoid mutating the input:
  const oSpecs = [...aSpecs];
  const oElsStruct = [];
  for (const oEl of aElsFlat) StructIn(oEl, oSpecs, 0, oElsStruct);
  return oElsStruct;
}

function StructIn(aElFlat, aSpecs, aIdxSpec, aElsStruct) {
  // This is very hard to understand. Is there a simpler implementation? [TO DO]

  if (aSpecs.length < 1) return;

  const oSpec = aSpecs[aIdxSpec];

  // Add a new record at this level?:
  if (
    !oSpec.ElStructLast ||
    !oSpec.NameKey ||
    aElFlat[oSpec.NameKey] != oSpec.ElStructLast[oSpec.NameKey]
  ) {
    oSpec.ElStructLast = {};

    // Reset the state in levels below this one:
    for (let o = aIdxSpec + 1; o < aSpecs.length; ++o) delete aSpecs[o].ElStructLast;

    // Add the fields at this level:
    for (const oProp of oSpec.Props) oSpec.ElStructLast[oProp] = aElFlat[oProp];

    if (oSpec.NameChild) oSpec.ElStructLast[oSpec.NameChild] = [];

    aElsStruct.push(oSpec.ElStructLast);
  }

  if (oSpec.Exec) oSpec.Exec(oSpec.ElStructLast, aElFlat);

  // Recursively add this level's children, if any:
  if (oSpec.NameChild) {
    StructIn(aElFlat, aSpecs, aIdxSpec + 1, oSpec.ElStructLast[oSpec.NameChild]);
  }
}

export const MillisecPerDay = 24 * 60 * 60 * 1000;

/** Returns the number of days by which aDateL exceeds aDateR. */
export function DiffDays(aDateL, aDateR) {
  return (aDateL - aDateR) / MillisecPerDay;
}

/** Returns a copy of the specified object that replaces all text 'When'
 *  properties with UTC Date instances. Returns 'null' instead if any 'When'
 *  parameter has an invalid text value.
 *
 * Normally, when receiving text input from the user, the conversion is
 * performed by 'Form.js'. This function is useful when Form is not in use:
 */
export function DataWhenDateUTC(aData) {
  const oData = { ...aData };
  const oOptsTime = { zone: TimeZoneUser };
  for (const oProp in oData)
    if (oProp.startsWith("When")) {
      const oDateTimeUTC = DateTime.fromISO(oData[oProp], oOptsTime);
      if (!oDateTimeUTC.isValid) return null;

      oData[oProp] = oDateTimeUTC.toJSDate();
    }
  return oData;
}

/** Converts a Date into a user-time-zone date string that Excel will
 *  recognize. */
export function TextDateExcel(aDate) {
  const oOpts = {
    timeZone: TimeZoneUser,
  };
  return aDate.toLocaleDateString("en-US", oOpts);
}

/** Converts a Date into a user-time-zone date/time string that Excel will
 *  recognize. */
export function TextDateTimeExcel(aDate) {
  const oOpts = {
    timeZone: TimeZoneUser,
  };
  return aDate.toLocaleDateString("en-US", oOpts) + " " + aDate.toLocaleTimeString("en-US", oOpts);
}

/** Returns a value that sorts records aL and aR by date field aProp, in
 *  ascending order. */
export function CompWhenAsc(aL, aR, aProp) {
  const oDateL = new Date(aL[aProp]);
  const oDateR = new Date(aR[aProp]);
  if (oDateL < oDateR) return -1;
  if (oDateL > oDateR) return 1;
  return 0;
}

/** Returns a value that sorts records aL and aR by date field aProp, in
 *  descending order. */
export function CompWhenDesc(aL, aR, aProp) {
  return -CompWhenAsc(aL, aR, aProp);
}

// ----
// Text
// ----

/** Returns 'true' if the specified text contains a valid integer. */
export function CkInt(aText) {
  return aText.match(/^\s*\d+\s*$/);
}

/** Returns 'true' if the specified text contains a valid floating-point number. */
export function CkFloat(aText) {
  // Adapted from https://stackoverflow.com/a/52986361/3728155:
  //
  return !isNaN(parseFloat(aText)) && isFinite(aText);
}

/** Returns aText with occurances of aSubOrig replaced by aSubNew. */
export function ReplaceAll(aText, aSubOrig, aSubNew) {
  return aText.replace(new RegExp(aSubOrig, "g"), aSubNew);
}

/** Returns a string containing the specified values, delimited by aDelim,
 *  excepting those that are 'null' or 'undefined'. */
export function JoinDefined(aDelim, ...aVals) {
  return aVals
    .filter(oVal => {
      return oVal !== undefined && oVal !== null;
    })
    .join(aDelim);
}

/** Returns the plural form of a word, if the specified count is greater than
 *  zero and less than or equal to one. If aWordPlur is not provided, the plural
 *  will be formed by adding 's'.*/
export function Plural(aCt, aWordSing, aWordPlur) {
  // It seems to me that fractions less than one should use the singular form:
  return aCt > 0 && aCt <= 1 ? aWordSing : aWordPlur || aWordSing + "s";
}

// Formatting
// ----------

export function TextBool(aVal) {
  return aVal ? "true" : "false";
}

export function TextYesNo(aVal) {
  return aVal ? "Yes" : "No";
}

export function TextIDCat(aID) {
  return aID.toString().padStart(3, "0");
}

export function TextIDSubcat(aID) {
  return aID.toString().padStart(3, "0");
}

export function TextIDCyc(aID) {
  return aID.toString().padStart(3, "0");
}

export function TextIDCart(aID) {
  return aID.toString().padStart(9, "0");
}

export function TextIDMemb(aID) {
  return aID.toString().padStart(5, "0");
}

export function TextIDProducer(aID) {
  return aID.toString().padStart(4, "0");
}

export function TextIDProduct(aID) {
  return aID.toString().padStart(6, "0");
}

export function TextIDVty(aID) {
  return aID.toString().padStart(7, "0");
}

export function NameVty(aVty) {
  // I would prefer to display Size at the end of the name, but that causes Size
  // to be truncated sometimes (especially on item labels) when Kind is
  // relatively long. Variety listings can continue to be sorted by Kind, then
  // Size.

  // If the variety is variable-price, Size will not be set, but WgtMin and
  // WgtMax will be:
  let oName = aVty.Size ? aVty.Size : TextWgtEst(aVty);
  // The Kind is optional:
  if (aVty.Kind) oName += ", " + aVty.Kind;
  return oName;
}

export function NameProductVty(aProduct, aVty) {
  let oName = `${aProduct.NameProduct}, `;
  if (aVty.Kind) oName += `${aVty.Kind}, `;
  oName += aVty.Size ? aVty.Size : TextWgtEst(aVty);
  return oName;
}

export function TextWgt(aWgt) {
  return Number(aWgt).toFixed(2);
}

export function TextIDInvcTransact(aIDInvc, aCdTypeTransact) {
  switch (aCdTypeTransact) {
    case "EarnInvcProducerWeb":
      return TextIDInvcProducerWeb(aIDInvc);
    case "EarnInvcProducerOnsite":
      return TextIDInvcProducerOnsite(aIDInvc);
    case "EarnInvcProducerOnsiteWholesale":
      return TextIDInvcProducerOnsite(aIDInvc);
    case "ChargeInvcShopWeb":
      return TextIDInvcShopWeb(aIDInvc);
    case "ChargeInvcShopOnsite":
      return TextIDInvcShopOnsite(aIDInvc);
    case "ChargeInvcShopOnsiteWholesale":
      return TextIDInvcShopOnsite(aIDInvc);
  }
  throw Error("Util TextIDInvcTransact: Invalid transaction type for invoice");
}

// Because the various invoices are stored in separate tables, their ID numbers
// will overlap. When displayed to users, therefore, they must be distinguished
// with a suffix:
//
//   Code  Invoice type
//   ----  ------------
//   PW    Web producer
//   SW    Web shopper
//   PN    On-site producer
//   SN    On-site shopper
//
// We will use 'N' in place of 'O' to avoid confusion with the number zero.

export function TextIDInvcProducerWeb(aID) {
  return aID.toString().padStart(5, "0") + "-PW";
}

export function TextIDInvcShopWeb(aID) {
  return aID.toString().padStart(6, "0") + "-SW";
}

export function TextIDInvcProducerOnsite(aID) {
  return aID.toString().padStart(5, "0") + "-PN";
}

export function TextIDInvcShopOnsite(aID) {
  return aID.toString().padStart(6, "0") + "-SN";
}

export function TextIDTransact(aID) {
  return aID.toString().padStart(10, "0");
}

export function PathFileStoreDoc() {
  return join(process.cwd(), DocumentStoragePrefix);
}

/** Returns the combined path and name for a StoreDoc file with the specified
 *  name. */
export function PathNameFileStoreDoc(aNameFile) {
  return join(PathFileStoreDoc(), aNameFile);
}

/** Converts a Date into a user-time-zone ISO 8601 'yyyy-mm-ddThh:mm' string
 *  suitable for the value of a 'datetime-local' HTML input. */
export function TextDateTimeInput(aDate) {
  const oDateTime = DateTime.fromJSDate(aDate).setZone(TimeZoneUser);
  const oTextDate = oDateTime.toISODate();
  const oTextTime = oDateTime.toISOTime({
    suppressSeconds: true,
    includeOffset: false,
  });
  return oTextDate + "T" + oTextTime;
}

/** Converts a Date into a user-time-zone 'MMM DD, YYYY' string. */
export function TextDateMed(aDate) {
  const oOpts = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TimeZoneUser,
  };
  return aDate.toLocaleDateString("en-US", oOpts);
}

/** Converts a Date into a user-time-zone 'MMM DD, YYYY, h:mm AM/PM' string. */
export function TextDateTimeMed(aDate) {
  const oOpts = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TimeZoneUser,
  };
  return aDate.toLocaleDateString("en-US", oOpts);
}

/** Converts a Date into a user-time-zone 'MMMM DD, YYYY' string. */
export function TextDateLong(aDate) {
  const oOpts = {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TimeZoneUser,
  };
  return aDate.toLocaleDateString("en-US", oOpts);
}

/** Converts a Date into a user-time-zone 'MMMM DD, YYYY, h:mm AM/PM' string. */
export function TextDateTimeLong(aDate) {
  const oOpts = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TimeZoneUser,
  };
  return aDate.toLocaleDateString("en-US", oOpts);
}

/** Converts a Date to a user-time-zone string. Setting aFmtDate or aFmtTime to
 * a falsy value causes that part of the string to be omitted.
 *
 * aFmtDate can be:
 *
 *   'NoYear': 'MMM DD'
 *   'FullNoYear': 'DDD MMM DD
 *   'Short': 'MM/DD/YYYY'
 *   'FullShort': 'DDD MM/DD/YYYY'
 *   'Med': 'MMM, D YYYY'
 *   'FullMed': 'DDD MMM, D YYYY'
 *   'Long': 'MMMM, D YYYY'
 *   'FullLong': 'DDDD MMMM, D YYYY'
 *
 * aFmtTime can be:
 *
 *   'Short': 'hh:mm:ss'
 *   'HourMin': 'h:mm AM/PM'
 *   'HourMinSec': 'h:mm:ss AM/PM'
 *
 */
export function TextWhen(aWhen, aFmtDate, aFmtTime) {
  let oTextDate = "";
  let oTextTime = "";

  if (aFmtDate) {
    if (aFmtDate.endsWith("Long")) {
      if (aFmtDate.startsWith("Full")) {
        const oOptsFull = {
          timeZone: TimeZoneUser,
          // Full weekday name:
          weekday: "long",
        };
        // Adding this option with the others introduces an unwanted comma:
        oTextDate = aWhen.toLocaleDateString("en-US", oOptsFull) + " ";
      }

      const oOptsLong = {
        timeZone: TimeZoneUser,
        // Full month name:
        month: "long",
        day: "numeric",
        year: "numeric",
      };
      oTextDate += aWhen.toLocaleDateString("en-US", oOptsLong);
    } else if (aFmtDate.endsWith("Med")) {
      if (aFmtDate.startsWith("Full")) {
        const oOptsFull = {
          timeZone: TimeZoneUser,
          // Abbreviated weekday name:
          weekday: "short",
        };
        // Adding this option with the others introduces an unwanted comma:
        oTextDate = aWhen.toLocaleDateString("en-US", oOptsFull) + " ";
      }

      const oOptsMed = {
        timeZone: TimeZoneUser,
        // Abbreviated month name:
        month: "short",
        day: "numeric",
        year: "numeric",
      };
      oTextDate += aWhen.toLocaleDateString("en-US", oOptsMed);
    } else if (aFmtDate.endsWith("Short")) {
      if (aFmtDate.startsWith("Full")) {
        const oOptsFull = {
          timeZone: TimeZoneUser,
          // Abbreviated weekday name:
          weekday: "short",
        };
        // Adding this option with the others introduces an unwanted comma:
        oTextDate = aWhen.toLocaleDateString("en-US", oOptsFull) + " ";
      }

      const oOptsShort = {
        timeZone: TimeZoneUser,
        // 'MM/DD/YY':
        dateStyle: "short",
      };
      oTextDate += aWhen.toLocaleDateString("en-US", oOptsShort);
    } else if (aFmtDate.endsWith("NoYear")) {
      if (aFmtDate.startsWith("Full")) {
        const oOptsFull = {
          timeZone: TimeZoneUser,
          // Full weekday name:
          weekday: "long",
        };
        // Adding this option with the others introduces an unwanted comma:
        oTextDate = aWhen.toLocaleDateString("en-US", oOptsFull) + " ";
      }

      const oOptsLong = {
        timeZone: TimeZoneUser,
        // Full month name:
        month: "long",
        day: "numeric",
      };
      oTextDate += aWhen.toLocaleDateString("en-US", oOptsLong);
    } else throw Error("Util TextWhen: Invalid date format");
  }

  if (aFmtTime) {
    if (aFmtTime === "Short") {
      const oOptsShort = {
        timeZone: TimeZoneUser,
        hour12: false,
        // 'hh:mm' (12-hour):
        timeStyle: "short",
      };
      oTextTime = aWhen.toLocaleTimeString("en-US", oOptsShort);

      if (oTextTime.length < 5) oTextTime = "0" + oTextTime;
      oTextTime += ":" + aWhen.getSeconds().toString().padStart(2, "0");
    } else if (aFmtTime.startsWith("HourMin")) {
      const oOptsHourMin = {
        timeZone: TimeZoneUser,
        hour: "numeric",
        minute: "2-digit",
      };
      if (aFmtTime.endsWith("Sec")) oOptsHourMin.second = "2-digit";

      oTextTime = aWhen.toLocaleTimeString("en-US", oOptsHourMin);
    } else throw Error("Util TextWhen: Invalid time format");
  }

  return oTextDate && oTextTime ? oTextDate + " " + oTextTime : oTextDate + oTextTime;
}

/** Returns a formatted phone number, if aPhone is in canonical form. Returns
 *  the original value, if it is not, so that invalid form entries can be edited
 *  without confusion. */
export function TextPhoneOrOrig(aPhone) {
  const oPattPhone = /^(\d{10})$/;
  if (!oPattPhone.test(aPhone)) return aPhone;

  // After a validation failure, it is confusing to format a very short number:
  if (aPhone.length < 6) return aPhone;

  const oArea = aPhone.substr(0, 3);
  const oExch = aPhone.substr(3, 3);
  const oNum = aPhone.substr(6, 4);
  return `(${oArea})${oExch}-${oNum}`;
}

export function TextCurr(aVal) {
  if (aVal === undefined) return "";

  // Round before 'toFixed' so that the sign check at the end won't be triggered
  // by very small negative numbers:
  const oNum = round(Number(aVal), 2);
  const oTextNum = oNum.toFixed(2);
  // I am guessing that the negative sign will be more widely understood than
  // parentheses. If so, place the negative sign before the dollar sign:
  return oNum < 0 ? `-$${oTextNum.slice(1)}` : "$" + oTextNum;
}

export function TextPercent(aVal, aCtDigitFrac) {
  if (aVal === undefined) return "";

  const oNum = Number(aVal) * 100.0;
  return oNum.toFixed(aCtDigitFrac) + "%";
}

export function TextIdentity(aVal) {
  if (aVal === undefined) return "";
  return aVal;
}

// ------------
// Form content
// ------------

/** Returns an array of product category IDs representing category selections in
 *  the 'body' object. The category properties in that object are expected to be
 *  named 'CatX', with 'X' being the category ID. */
export function CatsFromForm(aBody) {
  const oIDs = [];
  for (const oName in aBody) {
    const oMatch = oName.match(/Cat(\d+)/);
    if (oMatch && oMatch.length > 1) oIDs.push(Number(oMatch[1]));
  }
  return oIDs;
}

// --------------
// Business logic
// --------------

// Cycles and phases
// -----------------

/** Returns the previous cycle ID, or the current one, if the delivery window
 *  has closed, or zero if there is no previous cycle. */
export function IDCycPrevProducer(aStApp, aCycPrev, aCycCurr) {
  return PhaseCycLess(aStApp.CdPhaseCyc, "EndDeliv")
    ? (aCycPrev && aCycPrev.IDCyc) || 0
    : aCycCurr.IDCyc;
}

// Listing statuses
// ----------------

/** Adds CdListProduct and QtyOrd properties to each aProducts record, after
 *  deriving them from the contained Vtys records. */
export function Add_PropsProduct(aProducts) {
  for (const oProduct of aProducts) {
    oProduct.CdListProduct = "Archiv";
    oProduct.CkContainList = false;
    oProduct.CkContainUnlist = false;
    oProduct.CkContainArchiv = false;
    oProduct.QtyOrd = 0;

    for (const oVty of oProduct.Vtys) {
      if (oVty.CkListWeb || oVty.CkListOnsite) {
        oProduct.CdListProduct = "List";
        oProduct.CkContainList = true;
      } else if (oVty.CkArchiv) oProduct.CkContainArchiv = true;
      else {
        oProduct.CdListProduct = "Unlist";
        oProduct.CkContainUnlist = true;
      }

      if (oVty.QtyOrd) oProduct.QtyOrd += oVty.QtyOrd;
    }
  }
}

export const CtDigitCurrAcct = 4;

export function CkEqCurrAcct(aValL, aValR) {
  aValL = round(aValL, CtDigitCurrAcct);
  aValR = round(aValR, CtDigitCurrAcct);
  return aValL === aValR;
}

/** Returns an object that contains the specified cart data, plus the TtlsCart
 *  data, derived from the promised quantities. */
export function SummCart(aCart, aItsCart, aMemb) {
  const oCkRegEBT = aMemb.CdRegEBT === "Approv";
  const oCkRegWholesale = aMemb.CdRegWholesale === "Approv";
  const oTtls = TtlsCart(
    aItsCart,
    "QtyProm",
    "PriceNomWeb",
    oCkRegEBT,
    aCart.CdLoc,
    aMemb.DistDeliv,
    oCkRegWholesale,
  );

  return {
    ...aCart,
    ...oTtls,
  };
}

/** Returns 'true' if the specified number is a valid item weight. */
export function CkWgtVal(aWgt) {
  return aWgt >= 0.01 && aWgt <= 99.99;
}

/** Returns the estimated item weight, which is the average of WgtMin and
 *  WgtMax, or one if these are not defined. */
export function WgtEst(aIt) {
  if (!aIt.WgtMin || !aIt.WgtMax) return undefined;
  return (aIt.WgtMin + aIt.WgtMax) / 2.0;
}

/** Returns text giving the estimated item weight. */
export function TextWgtEst(aIt) {
  const oWgtEst = WgtEst(aIt);
  if (!oWgtEst) return "ERROR";

  const oWgtEstRound = round(oWgtEst, 2);
  return "~" + oWgtEstRound + Plural(oWgtEstRound, " lb");
}

/** Returns the nominal sale subtotal for the specified cart item. aNameQty and
 *  aNamePrice should give quantity and price names from the item record, such
 *  as 'QtyProm' or 'QtyDeliv' and 'PriceNomWeb' or 'PriceNomOnsite'. */
export function SaleNom(aIt, aNameQty, aNamePrice) {
  const oQty = aIt[aNameQty];
  const oPrice = aIt[aNamePrice];

  // See 'Rounding currency' in 'README.md' for a discussion of sale subtotal
  // rounding.

  // A total weight has been provided. We will call this 'pricing by group
  // weight', since the rounding occurs after all items have been added:
  if (aIt.WgtTtl) return round(aIt.WgtTtl * oPrice, 2);

  // A per-unit weight has been provided. We will call this 'pricing by item
  // weight', since the rounding occurs before items have been added. This
  // ensures that the variety price is equal to the sum of the individual
  // prices, if the items were sold separately:
  if (aIt.WgtPer)
    // We must round before we multiply by the quantity to ensure that the total
    // price equals the some of the individual prices:
    return oQty * round(aIt.WgtPer * oPrice, 2);

  // No weight has been provided, but the item is weighted:
  if (aIt.CkPriceVar) return oQty * round(WgtEst(aIt) * oPrice, 2);

  // The item is not weighted:
  return round(oQty * oPrice, 2);
}

/** Returns the delivery or transfer fee appropriate for the specified location
 *  type and distance. Note that the fee may be disregarded for other reasons,
 *  for instance, if the shopper is EBT-eligible, or if none of their items were
 *  delivered. */
export function FeeDelivTransfer(aCdTypeLoc, aDistDeliv) {
  switch (aCdTypeLoc) {
    case "Deliv":
      // The delivery distance will be 'null' if it has not been set in the
      // member record:
      return Site.FeeDelivBase + (aDistDeliv ? Site.FeeDelivMile * aDistDeliv : 0);
    case "Satel":
      return Site.FeeTransfer;
    default:
      return 0.0;
  }
}

/** Calculates totals for a web or on-site cart. Returns an object containing
 *  the aItsCart elements, with the SaleNom and CkTaxSaleEff properties added to
 *  each record, plus total quantities for properties that begin with 'Qty', the
 *  estimated sales total, various subtotals, and the tax and fee amounts:
 *
 *    Its
 *    SaleNom
 *    SaleNomNontaxab
 *    FeeCoopShopNontaxab
 *    SubNontaxab
 *    SaleNomTaxab
 *    FeeCoopShopTaxab
 *    TaxSale
 *    SubTaxab
 *    FeeCoopShop
 *    FeeCoopShopForgiv
 *    FeeDelivTransfer
 *    TtlMoney
 *    TtlEBT
 *    Ttl
 *
 *  The quantity to be used when calculating these totals is determined by
 *  aPropQty, which should set to an item quantity name, such as 'QtyProm' or
 *  'QtyDeliv'. FeeDelivTransfer will be set to NaN if the delivery distance is
 *  not known. Leave aCdLoc and aDistDeliv undefined if an on-site cart is being
 *  totaled. */
export function TtlsCart(
  aItsCart,
  aNameQty,
  aNamePrice,
  aCkRegEBT,
  aCdLoc,
  aDistDeliv,
  aCkRegWholesale,
) {
  const oTtls = {
    Its: cloneDeep(aItsCart),

    SaleNomNontaxab: 0,
    SaleNomTaxab: 0,
    FeeCoopShopTaxab: 0,
    FeeCoopShopNontaxab: 0,
    FeeCoopShopForgiv: 0,
    TtlEBT: 0,
  };
  const oEbtCustomer = !!aCkRegEBT;

  /** Uses properties in aIt with names that begin with aPrefixName to create
   *  and then increment totals in oTtls. */
  function oInc_Ttls(aIt, aPrefixName) {
    for (const oName in aIt) {
      if (!oName.startsWith(aPrefixName)) continue;

      if (oTtls[oName] === undefined) oTtls[oName] = 0;
      oTtls[oName] += aIt[oName];
    }
  }

  for (const oIt of oTtls.Its) {
    const oEbtEligableItem = oIt.CkEBT;
    // EBT shoppers do not pay coop fee,
    // but the coop pays back (forgiven) the coop fee from donations
    const { feeCoopShopEff: oFeeCoopShopEff, feeCoopShopForgivEff: oFeeCoopShopForgivEff } =
      calculateEffCoopFeeMemb({
        aIsEbtCustomer: !!oEbtCustomer,
        aIsWholesaleCustomer: !!aCkRegWholesale,
        aIsWholeSaleItem: oIt.CdVtyType === "Wholesale",
        aFracFeeCoopWholesaleMemb: oIt.FracFeeCoopWholesaleMemb,
      });

    oInc_Ttls(oIt, "Qty");

    oIt.SaleNom = SaleNom(oIt, aNameQty, aNamePrice);

    // The total EBT is the amount the shopper can pay with an EBT card
    // has to be: EBT shopper + EBT eligible item
    if (oEbtEligableItem && oEbtCustomer) {
      oTtls.TtlEBT += oIt.SaleNom;
    }

    // EBT shoppers do not pay sales tax on EBT-eligible items
    oIt.CkTaxSaleEff = oIt.CkTaxSale && (!oEbtEligableItem || !oEbtCustomer);

    // If the product is marked as not having a consumer fee, then the fee is 0
    // TODO: move this out from this function --> keep the function pure
    const skipCoopFeeCalculation = oIt.CkExcludeConsumerFee;
    if (skipCoopFeeCalculation) {
      oIt.FeeCoopShop = 0.0;
      oIt.FeeCoopShopForgiv = 0.0; // No fee ==> No fee to forgive
    } else {
      // Calculate the coop fee (and the forgiven fee) for the item
      oIt.FeeCoopShop = round(oIt.SaleNom * oFeeCoopShopEff, CtDigitCurrAcct);
      oIt.FeeCoopShopForgiv = round(oIt.SaleNom * oFeeCoopShopForgivEff, CtDigitCurrAcct);

      oTtls.FeeCoopShopForgiv += oIt.FeeCoopShopForgiv;

      if (oIt.CkTaxSaleEff) {
        oTtls.FeeCoopShopTaxab += oIt.FeeCoopShop;
      } else {
        oTtls.FeeCoopShopNontaxab += oIt.FeeCoopShop;
      }
    }

    const oSub = oIt.SaleNom + oIt.FeeCoopShop;
    oIt.Sub = oSub;

    oIt.TaxSale = oIt.CkTaxSaleEff ? round(oSub * Site.FracTaxSale, CtDigitCurrAcct) : 0;

    if (oIt.CkTaxSaleEff) {
      oIt.Sub += oIt.TaxSale;
      oTtls.SaleNomTaxab += oIt.SaleNom;
    } else {
      oTtls.SaleNomNontaxab += oIt.SaleNom;
    }
  }

  // Total Nomminal Sale (without fees and taxes)
  oTtls.SaleNom = oTtls.SaleNomNontaxab + oTtls.SaleNomTaxab;

  // Sub Total Non Taxable (sale + fee)
  oTtls.SubNontaxab = oTtls.SaleNomNontaxab + oTtls.FeeCoopShopNontaxab;

  // Sub Total Taxable (sale + fee)
  oTtls.SubTaxab = oTtls.SaleNomTaxab + oTtls.FeeCoopShopTaxab;

  // Total Sales Tax
  oTtls.TaxSale = round(oTtls.SubTaxab * Site.FracTaxSale, 2);

  // Total Fee Coop Shop (taxable + non-taxable)
  oTtls.FeeCoopShop = oTtls.FeeCoopShopNontaxab + oTtls.FeeCoopShopTaxab;

  if (aCdLoc) {
    const oLoc = Locs[aCdLoc];
    if (!oLoc) throw Error(`Util TtlsCart: Invalid location code '${aCdLoc}'`);
    // EBT members are not charged for delivery or transfer. Also, no reason to
    // charge if the entire order is OOS:
    oTtls.FeeDelivTransfer =
      !aCkRegEBT && oTtls[aNameQty] > 0 ? FeeDelivTransfer(oLoc.CdTypeLoc, aDistDeliv) : 0.0;
  }

  // Delivery charges are taxable when taxable items are included, and
  // non-taxable when they are not.
  // That is way too complex, and the amounts are small,
  // so I recommended that the market pay the delivery taxes itself, and not
  // bother the users with it. For that reason, tax is disregarded here.
  const oDeliveryFee = oTtls.FeeDelivTransfer || 0;

  // Total amount the shopper has to pay (including EBT)
  oTtls.Ttl = oTtls.SubNontaxab + oTtls.SubTaxab + oTtls.TaxSale + oDeliveryFee;

  // The total money is the amount an EBT shopper cannot pay with an EBT card
  // for a non-EBT shopper, this is the same as the total
  oTtls.TtlMoney = oTtls.Ttl - oTtls.TtlEBT;

  return oTtls;
}

function calculateEffCoopFeeMemb(opts) {
  const { aIsEbtCustomer, aIsWholesaleCustomer, aIsWholeSaleItem, aFracFeeCoopWholesaleMemb } =
    opts;
  if (aIsEbtCustomer) {
    return {
      feeCoopShopEff: 0.0,
      feeCoopShopForgivEff: Site.FracFeeCoopShop,
    };
  }

  if (aIsWholesaleCustomer && aIsWholeSaleItem) {
    return {
      feeCoopShopEff: aFracFeeCoopWholesaleMemb ?? Site.FracFeeCoopWholesaleMemb,
      feeCoopShopForgivEff: 0.0,
    };
  }

  return {
    feeCoopShopEff: Site.FracFeeCoopShop,
    feeCoopShopForgivEff: 0.0,
  };
}

export function Add_CkTaxSaleEff(aEl, aCkRegEBT) {
  // This should be called by TtlsCart, which instead repeats the code. [TO DO]

  // Apparently, EBT shoppers do not pay sales tax on EBT-eligible items:
  aEl.CkTaxSaleEff = aEl.CkTaxSale && (!aEl.CkEBT || !aCkRegEBT);
}

export async function Add_CkExcludeConsumerFee(aItsCart) {
  const oItsCart = cloneDeep(aItsCart);

  for (const oIt of oItsCart) {
    const feeCheck = await getProductRow(oIt.IDProduct);
    oIt.CkExcludeConsumerFee = !!(feeCheck[0] && feeCheck[0].CkExcludeConsumerFee);
  }
  return oItsCart;
}

export function Add_FullPriceToVty(aVty, aIsUserEbtEligible) {
  return {
    ...aVty,
    PriceFullWeb: wCalculateFullPrice(
      aVty.PriceNomWeb,
      aIsUserEbtEligible,
      aVty.CkExcludeConsumerFee,
    ),
  };
}

export function Add_FullPriceToVtyMutate(aVty, aIsUserEbtEligible) {
  aVty.PriceFullWeb = wCalculateFullPrice(
    aVty.PriceNomWeb,
    aIsUserEbtEligible,
    aVty.CkExcludeConsumerFee,
  );
}

// Full price is the Nominal Price + Consumer Fee: Nominal Price * (1 + FracFeeCoopShop)
function wCalculateFullPrice(aPriceNomWeb, aIsUserEbtEligible, aExcludeConsumerFee) {
  const oIsNoCoopFee = !!aIsUserEbtEligible || !!aExcludeConsumerFee;
  const oCustomerFeeFrac = oIsNoCoopFee ? 1 : 1 + Site.FracFeeCoopShop;
  return round(aPriceNomWeb * oCustomerFeeFrac, 2);
}

// 'Next page' selection
// ---------------------
// These functions should be used to return to the previous page when the
// current page can be reached by multiple paths.

/** Returns the page to be displayed after editing a member. */
export function PageAfterEditMemb(aReq, _aResp) {
  const oPagesAllow = ["member"];
  if (aReq.user.CkStaff()) {
    oPagesAllow.push("member-search-results");
    oPagesAllow.push("member-detail");
  }
  return PagePrev(aReq, oPagesAllow) || "/member";
}

/** Returns the page to be displayed after editing a producer. */
export function PageAfterEditProducer(aReq, _aResp) {
  const oPagesAllow = ["producer"];
  if (aReq.user.CkStaff()) {
    oPagesAllow.push("producer-search-results");
    oPagesAllow.push("producer-detail");
  }
  return PagePrev(aReq, oPagesAllow) || "/producer";
}

/** Returns the page to be displayed after editing a product. */
export function PageAfterEditProduct(aReq, _aResp) {
  const oPagesAllow = ["product-detail", "producer-catalog"];
  return PagePrev(aReq, oPagesAllow) || "/producer";
}

/** Returns the page to be displayed after checking-out a shopper. */
export function PageAfterCheckoutShop(aReq, _aResp) {
  const oPagesAllow = ["pickup-progress", "member-search-results", "member-detail"];
  return PagePrev(aReq, oPagesAllow) || "/distribution";
}

/** Returns the page to be displayed after checking-in a producer. */
export function PageAfterCheckInProducer(aReq, _aResp) {
  const oPagesAllow = ["delivery-progress", "producer-search-results", "producer-detail"];
  return PagePrev(aReq, oPagesAllow) || "/distribution";
}

/** Returns the most recent page history entry with a 'base' that matches an
 *  entry in aBasesAllow. The 'base' is the string between the root slash and
 *  the next slash or question mark. */
export function PagePrev(aReq, aBasesAllow) {
  const oHist = aReq.session.HistPage;
  if (!oHist) return null;

  // The last history entry is the current page:
  for (let oIdxHist = oHist.length - 2; oIdxHist >= 0; --oIdxHist) {
    // An earlier version compared the base with 'startsWith', but that ignored
    // the fact that some pages (like 'producer-catalog') start with strings
    // that also specify valid pages ('producer').

    const oPageHist = oHist[oHist.length - 2];
    const oPartsHist = oPageHist.split(/[/?]/);
    if (oPartsHist.length < 2) continue;

    const oBaseHist = oPartsHist[1];
    if (!aBasesAllow || aBasesAllow.some(oBaseAllow => oBaseHist === oBaseAllow)) return oPageHist;
  }
  return null;
}

// -----------
// Miscellanea
// -----------

/** Returns a random alphanumeric string of the specified length. All letters
 *  are uppercase. 'I' and 'O' are excluded. */
export function NameRndAlphaNum(aLen) {
  if (aLen < 1) throw Error("Util NameRndAlphaNum: Invalid key length");

  const oChs = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "J",
    "K",
    "L",
    "M",
    "N",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
  ];

  let oKey = "";
  for (let o = 0; o < aLen; ++o) {
    const oIdx = Math.floor(Math.random() * oChs.length);
    oKey += oChs[oIdx];
  }
  return oKey;
}

/** Sorts aVtyL and aVtyR by product and variety properties, returning negative
 *  one if aVtyL sorts before aVtyR, positive one if it sorts after, and zero if
 *  they are equivalent. */
export function Compare_Vty(aVtyL, aVtyR) {
  const oNameProductL = aVtyL.NameProduct ? aVtyL.NameProduct : "";
  const oNameProductR = aVtyR.NameProduct ? aVtyR.NameProduct : "";
  let oComp = oNameProductL.localeCompare(oNameProductR);
  if (oComp < 0) return -1;
  if (oComp > 0) return 1;

  if (aVtyL.IDProduct < aVtyR.IDProduct) return -1;
  if (aVtyL.IDProduct > aVtyR.IDProduct) return 1;

  const oKindL = aVtyL.Kind ? aVtyL.Kind : "";
  const oKindR = aVtyR.Kind ? aVtyR.Kind : "";
  oComp = oKindL.localeCompare(oKindR);
  if (oComp < 0) return -1;
  if (oComp > 0) return 1;

  const oSizeL = aVtyL.Size ? aVtyL.Size : "";
  const oSizeR = aVtyR.Size ? aVtyR.Size : "";
  oComp = oSizeL.localeCompare(oSizeR);
  if (oComp < 0) return -1;
  if (oComp > 0) return 1;

  if (aVtyL.WgtMin < aVtyR.WgtMin) return -1;
  if (aVtyL.WgtMin > aVtyR.WgtMin) return 1;

  if (aVtyL.WgtMax < aVtyR.WgtMax) return -1;
  if (aVtyL.WgtMax > aVtyR.WgtMax) return 1;

  if (aVtyL.IDVty < aVtyR.IDVty) return -1;
  if (aVtyL.IDVty > aVtyR.IDVty) return 1;

  const oNoteShopL = aVtyL.NoteShop ? aVtyL.NoteShop : "";
  const oNoteShopR = aVtyR.NoteShop ? aVtyR.NoteShop : "";
  oComp = oNoteShopL.localeCompare(oNoteShopR);
  if (oComp < 0) return -1;
  if (oComp > 0) return 1;

  const oWgtPerL = aVtyL.WgtPer ? aVtyL.WgtPer : 0;
  const oWgtPerR = aVtyR.WgtPer ? aVtyR.WgtPer : 0;
  if (oWgtPerL < oWgtPerR) return -1;
  if (oWgtPerL > oWgtPerR) return 1;

  return 0;
}
