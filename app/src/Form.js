// Form.js
// =======
// Form validation and processing system
//
// Implementation notes:
// - Field arrays not currently supported in validation
// - Field validation occurs before database operations
// - Transaction support available for database operations
// - Structured collection handling for multi-record forms

import {
  CdsReg,
  CdsStaff,
  CdsStor,
  CdsListVty,
  CdsProductMeat,
  CdsTypeTransactStaff,
  CdsMethPay,
  CdsVtyType,
  wMembFromNameLogin,
  Conn,
} from "./Db.js";
import { TimeZoneUser } from "../Cfg.js";

import validator from "validator";
const { isEmail, isURL } = validator;

import { DateTime } from "luxon";
import _ from "lodash";

export const Conv = {
  /** 'Named' converters that apply to fields with a specific name. A specific
   *  converter is selected if its name matches the entire field name, even if a
   *  general converter also matches. */
  Named: {},
  /** 'General' converters that apply to a range of similar fields. If no named
   *  converter matches, the converter is determined by the field name prefix. */
  Gen: {},
};

/** Stores the raw value, or 'null' if it is the empty string. */
Conv.Gen.Raw = function (aFld) {
  aFld.ValCook = aFld.ValRaw === "" ? null : aFld.ValRaw;
};

/** Trims a string value, and stores 'null' if the result is empty. */
Conv.Gen.Trim = function (aFld) {
  const oText = aFld.ValRaw.trim();
  aFld.ValCook = oText.length ? oText : null;
};

/** Converts form checkbox output into a boolean. */
Conv.Gen.Box = function (aFld) {
  if (aFld.ValRaw === "on") aFld.ValCook = true;
  else if (aFld.ValRaw === undefined) aFld.ValCook = false;
  else aFld.MsgFail = "This is not a checkbox value.";
};

/** Converts form checkbox output into a boolean, while passing values that are
 *  already booleans or boolean strings. This can be used with hidden boolean
 *  inputs (which apparently cannot produce 'undefined' results, as checkboxes
 *  can) or if some upstream middleware converts boolean form values. */
Conv.Gen.BoxOrBool = function (aFld) {
  switch (aFld.ValRaw) {
    case "on":
    case "true":
    case true:
      aFld.ValCook = true;
      break;

    case undefined:
    case null:
    case "":
    case "false":
    case false:
      aFld.ValCook = false;
      break;

    default:
      aFld.MsgFail = "This is not a checkbox value.";
      break;
  }
};

/** Converts a string to a number. */
Conv.Gen.Num = function (aFld) {
  // Adapted from https://stackoverflow.com/a/52986361/3728155:
  //
  const oText = aFld.ValRaw.trim();
  if (!oText.length) {
    aFld.ValCook = null;
    return;
  }

  const oVal = parseFloat(oText);
  if (!isNaN(oVal) && isFinite(oText)) aFld.ValCook = oVal;
  else aFld.MsgFail = "This is not a valid number.";
};

/** Converts a string to a number, treating any blank value as a zero. */
Conv.Gen.Qty = function (aFld) {
  // Adapted from https://stackoverflow.com/a/52986361/3728155:
  //
  const oText = aFld.ValRaw.trim();
  if (!oText.length) {
    aFld.ValCook = 0;
    return;
  }

  const oVal = parseFloat(oText);
  if (!isNaN(oVal) && isFinite(oText)) aFld.ValCook = oVal;
  else aFld.MsgFail = "This is not a valid number.";
};

/** Removes the '1' prefix, plus any phone number formatting characters. */
Conv.Gen.Phone = function (aFld) {
  if (aFld.ValRaw) {
    aFld.ValCook = aFld.ValRaw.replace(/[ ()-.]/g, "");
    if (aFld.ValCook[0] === "1") aFld.ValCook = aFld.ValCook.substring(1);
    if (aFld.ValCook === "") aFld.ValCook = null;
  } else aFld.ValCook = null;
};

/** Converts a string to an app-time-zone Date instance. */
Conv.Gen.When = function (aFld) {
  if (aFld.ValRaw) {
    try {
      // The string produced by the 'datetime-local' input does not include a
      // time zone offset. The 'fromISO' documentation says it will "convert the
      // time to [the] zone" specified by 'zone':
      //
      //   https://moment.github.io/luxon/docs/class/src/datetime.js~DateTime.html#static-method-fromISO
      //
      // However, it seems to convert *from* that zone instead, returning an
      // instance that uses the app time zone:
      const oOptsTime = { zone: TimeZoneUser };
      const oDateTime = DateTime.fromISO(aFld.ValRaw, oOptsTime);
      aFld.ValCook = oDateTime.isValid ? oDateTime.toJSDate() : (aFld.ValCook = null);
    } catch (oErr) {
      aFld.ValCook = null;
    }
  } else aFld.ValCook = null;
};

export const Valid = {
  /** 'Named' validators that apply to fields with a specific name. If 'Valid'
   *  is 'true', a specific validator is selected if its name matches the entire
   *  field name, even if a general validator also matches. */
  Named: {},
  /** 'General' validators apply to a range of similar fields. If 'Valid' is
   *  'true', and if no named validator matches, the validator is determined by
   *  the field name prefix. */
  Gen: {},
};

// General validators
// ------------------

/** Validates alphanumeric characters (A-Z, a-z, 0-9) */
Valid.Gen.AlphaNum = function (aFld) {
  const oChsInval = /[^0-9A-Za-z/]/;
  if (oChsInval.test(aFld.ValCook)) aFld.MsgFail = "This entry contains invalid characters.";
};

/** Validates standard name characters (letters, digits, common punctuation) */
Valid.Gen.Name = function (aFld) {
  const oChsInval = /[^0-9A-Za-z '",.!?@#$%&*\-+_():/]/;
  if (oChsInval.test(aFld.ValCook)) aFld.MsgFail = "This entry contains invalid characters.";
};

/** Validates extended character set for addresses */
Valid.Gen.Addr = function (aFld) {
  const oChsInval = /[^0-9A-Za-z '",.!?@#$%&*\-+_():/]/;
  if (oChsInval.test(aFld.ValCook)) aFld.MsgFail = "This entry contains invalid characters.";
};

/** Validates USPS two-letter state codes */
Valid.Gen.St = function (aFld) {
  const oText = aFld.ValCook.toUpperCase();
  // From https://en.wikipedia.org/wiki/List_of_U.S._state_abbreviations:
  const oSts = [
    // States, plus DC:
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
    // US territories:
    // "AS", "GU", "MP", "PR", "VI", "UM",
    // US military mail codes:
    // "AA", "AE", "AP"
  ];
  if (oSts.indexOf(oText) === -1) aFld.MsgFail = "Please enter a state abbreviation.";
};

/** Validates USPS ZIP codes (5 or 9 digits) */
Valid.Gen.Zip = function (aFld) {
  const oPattZip = /^(\d{5}|\d{9}|\d{5}[ -]\d{4})$/;
  if (!oPattZip.test(aFld.ValCook)) aFld.MsgFail = "Please enter a ZIP or ZIP+4 code.";
};

Valid.Gen.Phone = function (aFld) {
  // 'validator.js' includes an 'isMobilePhone' check, but it accepts nine-digit
  // numbers:
  const oPattPhone = /^(\d{10}|\d{3}[ -]\d{3}[ -]\d{4}|\(\d{3}\)\d{3}-\d{4})$/;
  if (!oPattPhone.test(aFld.ValCook)) aFld.MsgFail = "This is not a valid phone number.";
};

Valid.Gen.Email = function (aFld) {
  if (!isEmail(aFld.ValCook)) aFld.MsgFail = "This is not a valid e-mail address.";
};

/** Validates positive decimal weights (0.01-99.99) */
Valid.Gen.Wgt = function (aFld) {
  if (aFld.ValCook < 0.01 || aFld.ValCook > 99.99) {
    aFld.MsgFail = "You must enter a number between '0.01' and '99.99'.";
    return;
  }
};

/** Validates positive integers (>0) */
Valid.Gen.ID = function (aFld) {
  if (aFld.ValCook < 1) {
    aFld.MsgFail = "You must enter a number greater than zero.";
    return;
  }

  if (aFld.ValCook !== Math.floor(aFld.ValCook)) aFld.MsgFail = "You must enter a whole number.";
};

/** Validates non-negative integers (>=0) */
Valid.Gen.Qty = function (aFld) {
  if (aFld.ValCook < 0) {
    aFld.MsgFail = "You must enter a non-negative number.";
    return;
  }

  if (aFld.ValCook !== Math.floor(aFld.ValCook)) aFld.MsgFail = "You must enter a whole number.";
};

/** Validates decimal fractions (0.0-1.0) */
Valid.Gen.Frac = function (aFld) {
  if (aFld.ValCook < 0) {
    aFld.MsgFail = "You must enter a non-negative number.";
    return;
  }

  if (aFld.ValCook > 1) {
    aFld.MsgFail = "You must enter a number less than one.";
    return;
  }
};

/** Validates positive integers (>0) */
Valid.Gen.QtyNonZero = function (aFld) {
  if (aFld.ValCook < 1) {
    aFld.MsgFail = "You must enter a number greater than zero.";
    return;
  }

  if (aFld.ValCook !== Math.floor(aFld.ValCook)) aFld.MsgFail = "You must enter a whole number.";
};

/** Validates non-negative decimal distances */
Valid.Gen.Dist = function (aFld) {
  if (aFld.ValCook < 0) aFld.MsgFail = "This is not a valid distance.";
};

/** Validates currency amounts (0.00-999.99) */
Valid.Gen.Price = function (aFld) {
  if (aFld.ValCook < 0.0) aFld.MsgFail = "This is not a valid price.";
  else if (aFld.ValCook > 999.99) aFld.MsgFail = "The price may not be more than $999.99.";
};

/** Validates signed currency amounts (-9999.99-9999.99) */
Valid.Gen.Amt = function (aFld) {
  if (aFld.ValCook < -9999.99) aFld.MsgFail = "The amount may not be less than -$9999.99.";
  else if (aFld.ValCook > 9999.99) aFld.MsgFail = "The amount may not be more than $9999.99.";
};

/** Validates registration codes against system definitions */
Valid.Gen.CdReg = function (aFld) {
  if (!Object.keys(CdsReg).includes(aFld.ValCook))
    aFld.MsgFail = "This is not a valid registration code";
};

/** Validates staff codes against system definitions */
Valid.Gen.CdStaff = function (aFld) {
  if (!Object.keys(CdsStaff).includes(aFld.ValCook))
    aFld.MsgFail = "This is not a valid staff code";
};

/** Validates storage codes against system definitions */
Valid.Gen.CdStor = function (aFld) {
  if (!Object.keys(CdsStor).includes(aFld.ValCook))
    aFld.MsgFail = "This is not a valid storage code";
};

/** Validates variety listing status codes */
Valid.Gen.CdListVty = function (aFld) {
  if (!Object.keys(CdsListVty).includes(aFld.ValCook))
    aFld.MsgFail = "This is not a valid variety listing code";
};

/** Validates meat production type codes */
Valid.Gen.CdProductMeat = function (aFld) {
  if (!Object.keys(CdsProductMeat).includes(aFld.ValCook))
    aFld.MsgFail = "This is not a valid meat production type code";
};

/** Validates a valid URL. */
Valid.Gen.Url = function (aFld) {
  if (!isURL(aFld.ValCook)) aFld.MsgFail = "Please enter a valid url.";
};

/** Validates any string */
Valid.Gen.Any = function (aFld) {
  if (aFld.ValCook === null) aFld.MsgFail = "Please enter a value.";
};

/** Validates user-selectable transaction type codes. */
Valid.Named.CdTypeTransact = function (aFld) {
  if (!Object.keys(CdsTypeTransactStaff).includes(aFld.ValCook))
    aFld.MsgFail = "This is not a staff-selectable transaction type code";
};

/** Validates payment method codes. */
Valid.Named.CdMethPay = function (aFld) {
  if (!Object.keys(CdsMethPay).includes(aFld.ValCook))
    aFld.MsgFail = "This is not a payment method code";
};

/** Validates Variety Type codes. */
Valid.Named.CdVtyType = function (aFld) {
  if (!Object.keys(CdsVtyType).includes(aFld.ValCook))
    aFld.MsgFail = "This is not a variety type code";
};

// Named validators
// ----------------

/** Validates login names per system requirements
 *  Performs uniqueness check against database
 *  @async
 */
Valid.Named.NameLogin = async function (aFld) {
  // Every login name:
  //
  // ~ Must consist entirely of ASCII letters, numbers, and underscores;
  //
  // ~ Must start with an ASCII letter;
  //
  // ~ Must not conflict with any of the reserved names, such 'admin';
  //
  // ~ Must be unique.
  //
  // Login name comparisons will be case-insensitive.

  const oName = aFld.ValCook.toLowerCase();
  const oPattName = /^[A-Za-z]{1}[\w]*$/;
  if (!oPattName.test(oName)) {
    aFld.MsgFail =
      "Your username can contain only letters, numbers, and " +
      "underscores. It must begin with a letter.";
    return;
  }

  const oPattNamesReserve =
    /(admin|root|user|superuser|manager|distribution|accountant|staff|volunteer|ifc)/;
  if (oPattNamesReserve.test(oName) || (await wMembFromNameLogin(oName)))
    aFld.MsgFail = "That username is not available, please select another.";
};

/** Validates password requirements
 *  - Length: 12-50 characters
 *  - Content: All characters permitted
 */
Valid.Named.Pass = function (aFld) {
  if (aFld.ValCook.length < 12 || aFld.ValCook.length > 50)
    aFld.MsgFail = "Your password must be 12-50 characters in length.";
};

Valid.Named.PassNew = Valid.Named.Pass;

/** Validates delivery distance range (0.0-100.0) */
Valid.Named.DistDeliv = function (aFld) {
  if (aFld.ValCook < 0.0 || aFld.ValCook >= 100.0)
    aFld.MsgFail = "This is not a valid delivery distance.";
};

// ---------------
// Form processing
// ---------------
// Form data is validated by passing the request 'body' object to wExec, along
// with a second object containing one or more field specifications, each named
// after one input within the form:
//
//   const oFlds = {
//     Name1First: { CkRequire: true },
//     Name1Last: { CkRequire: true },
//     Name2First: {},
//     Name2Last: {},
//     Addr1: { CkRequire: true },
//     Addr2: {},
//     City: { CkRequire: true },
//     St: { CkRequire: true },
//     Zip: { CkRequire: true },
//     InstructDeliv: { Valid: false }
//   };
//   await gForm.wExec(aReq.body, oFlds);
//
// If no specification is provided for a given form input, that input will be
// ignored.
//
// Each field specification contains zero or more properties that determine how
// the field value is converted and validated, whether it is required, and how
// it might be used after validation. The specification also stores validation
// output, including the converted value, and the validation failure message, if
// any. Specification input properties include:
//
//   Conv
//   ----
//   This property determines whether the input value is converted and
//   sanitized:
//
//   ~ If set to 'true', the validation system compares the field name against
//     the properties in 'exports.Conv.Named'; if a match is found, that
//     function is used as a converter. If no match is found, the field name is
//     compared with a number of prefixes, such as 'Ck', 'ID', 'Num', et cetera.
//     If a prefix matches, an appropriate converter is selected from
//     'exports.Conv.Gen'. If no match is found, the input value is trimmed but
//     not converted.
//
//   ~ If set to a function, that function is used to convert the input.
//
//   ~ If set to 'false', no conversion or sanitization is performed.
//
//   This property is 'true' by default.
//
//   The converter will set MsgFail to a user-friendly validation failure
//   message if the conversion cannot be completed. Otherwise, it will store the
//   converted value in ValCook.
//
//   Conversion functions may not be 'async'.
//
//   CkRequire
//   ---------
//   This property determines whether the input is required. When set to 'true',
//   ValCook must be non-null after conversion, or MsgFail will be used to
//   prompt the user for input.
//
//   This property is 'false' by default.
//
//   Valid
//   -----
//   This property determines whether the input value is validated:
//
//   ~ If set to 'true', the validation system compares the field name against
//     the properties in 'exports.Valid.Named'; if a match is found, that
//     function is used as a validator. If no match is found, the field name is
//     compared with a number of prefixes, such as 'ID', 'Num', 'Wgt', et
//     cetera. If a prefix matches, an appropriate validator is selected from
//     'exports.Valid.Gen'. If no match is found, an exception is thrown.
//
//   ~ If set to a function, that function is used to validate the input.
//
//   ~ If set to 'false', no validation is performed.
//
//   This property is 'true' by default.
//
//   The validator will set MsgFail to a user-friendly validation failure
//   message if ValCook is invalid.
//
//   Unlike converters, validation functions can be 'async'. When added to
//   'exports.Valid.Named', such functions are not prefixed with 'w', however.
//
//   Store
//   -----
//   This module exports 'wIns' and 'wUpd' functions that can be used to write
//   the validated data to the database. The Store property determines whether
//   an input value is included when those functions are used:
//
//   ~ If set to 'true', the input is included in all queries that use this form
//     data.
//
//   ~ If set to a table name, it is included only in those queries that target
//     the named table.
//
//   ~ If set to 'false', it is never included.
//
//   This property is 'true' by default.
//
// Note that there is a default converter for fields that do not match one of
// the expected names or prefixes, but there is no default validator, so
// validation must be explicitly disabled when it is not wanted.
//
// An empty specification object can be used to accept all default values.
//
// The validation process adds a number of output properties to each
// specification, including:
//
//   ValRaw
//   ------
//   This property stores the original form input value, before conversion.
//
//   ValCook
//   -------
//   This property stores the converted and sanitized input value, which may or
//   may not be valid.
//
//   MsgFail
//   -------
//   This property stores a user-friendly validation failure message, if the
//   input is found to be invalid.
//
// See also the 'Form validation' section in 'View.js', which defines view
// helpers that style invalid fields, or display validation failure messages.

/** Validates the specified form fields. If object aFldsDisab is set, any field
 *  that shares a name with one of its properties will be ignored. */
export async function wExec(aBody, aFlds, aFldsDisab) {
  const oTasks = [];
  for (const oNameFld in aFlds) {
    if (aFldsDisab && aFldsDisab[oNameFld]) continue;

    oTasks.push(wExec_Fld(aBody, oNameFld, aFlds[oNameFld]));
  }
  await Promise.all(oTasks);
}

/** Validates the specified form field. */
async function wExec_Fld(aBody, aName, aSpec) {
  if (aSpec.Conv === undefined) aSpec.Conv = true;
  if (aSpec.Valid === undefined) aSpec.Valid = true;
  if (aSpec.CkRequire === undefined) aSpec.CkRequire = false;
  if (aSpec.Store === undefined) aSpec.Store = true;

  aSpec.ValRaw = aBody[aName];
  // The form could 'disable' a non-required input, which would exclude it from
  // the submission altogether:
  if (aSpec.ValRaw === undefined) aSpec.ValRaw = "";

  // Format validation, conversion, and sanitization
  // -----------------------------------------------

  let oConv;
  // A 'standard' converter is wanted:
  if (aSpec.Conv === true) {
    if (Conv.Named[aName]) oConv = Conv.Named[aName];
    // 'Ck' suggests a boolean, but this assumes a checkbox that produces "on"
    // or 'undefined'. See 'wWareData' in 'index.js' for more on this:
    else if (aName.startsWith("Ck")) oConv = Conv.Gen.BoxOrBool;
    else if (aName.startsWith("ID")) oConv = Conv.Gen.Num;
    else if (aName.startsWith("Num")) oConv = Conv.Gen.Num;
    else if (aName.startsWith("Wgt")) oConv = Conv.Gen.Num;
    else if (aName.startsWith("Frac")) oConv = Conv.Gen.Num;
    else if (aName.startsWith("Qty")) oConv = Conv.Gen.Qty;
    else if (aName.startsWith("Price")) oConv = Conv.Gen.Num;
    else if (aName.startsWith("Amt")) oConv = Conv.Gen.Num;
    else if (aName.startsWith("Dist")) oConv = Conv.Gen.Num;
    else if (aName.startsWith("Phone")) oConv = Conv.Gen.Phone;
    else if (aName.startsWith("When")) oConv = Conv.Gen.When;
    // Passwords can include spaces, and the default converter trims:
    else if (aName.startsWith("Pass")) oConv = Conv.Gen.Raw;
    else oConv = Conv.Gen.Trim;
  }
  // A custom converter was specified, or no conversion is wanted:
  else oConv = aSpec.Conv;

  if (oConv) oConv(aSpec);

  if (aSpec.MsgFail) return;

  // Content validation
  // ------------------

  if (aSpec.ValCook === null) {
    if (aSpec.CkRequire) aSpec.MsgFail = "Please enter a value.";
    return;
  }

  let owValid;
  // A 'standard' validator is wanted:
  if (aSpec.Valid === true) {
    if (Valid.Named[aName]) owValid = Valid.Named[aName];
    // Checkboxes were format-validated during conversion:
    else if (aName.startsWith("Ck")) owValid = false;
    // Replace these with something like?:
    //
    //   for (const oName in exports.Valid.Gen)
    //     if (aName.startsWith(oName)) owValid = exports.Valid.Gen[oName];
    //
    else if (aName.startsWith("ID")) owValid = Valid.Gen.ID;
    else if (aName.startsWith("Num")) owValid = Valid.Gen.Qty;
    else if (aName.startsWith("Wgt")) owValid = Valid.Gen.Wgt;
    else if (aName.startsWith("Qty")) owValid = Valid.Gen.Qty;
    else if (aName.startsWith("Frac")) owValid = Valid.Gen.Frac;
    else if (aName.startsWith("Dist")) owValid = Valid.Gen.Dist;
    else if (aName.startsWith("Price")) owValid = Valid.Gen.Price;
    else if (aName.startsWith("Amt")) owValid = Valid.Gen.Amt;
    else if (aName.startsWith("Name")) owValid = Valid.Gen.Name;
    else if (aName.startsWith("Addr")) owValid = Valid.Gen.Addr;
    else if (aName.startsWith("City")) owValid = Valid.Gen.City;
    else if (aName.startsWith("St")) owValid = Valid.Gen.St;
    else if (aName.startsWith("Zip")) owValid = Valid.Gen.Zip;
    else if (aName.startsWith("Phone")) owValid = Valid.Gen.Phone;
    else if (aName.startsWith("Email")) owValid = Valid.Gen.Email;
    else if (aName.startsWith("CdReg")) owValid = Valid.Gen.CdReg;
    else if (aName.startsWith("CdStaff")) owValid = Valid.Gen.CdStaff;
    else if (aName.startsWith("CdStor")) owValid = Valid.Gen.CdStor;
    else if (aName.startsWith("CdListVty")) owValid = Valid.Gen.CdListVty;
    else if (aName.startsWith("CdProductMeat")) owValid = Valid.Gen.CdProductMeat;
    else if (aName.startsWith("CdTypeTransact")) owValid = Valid.Gen.CdTypeTransact;
    else if (aName.startsWith("CdMethPay")) owValid = Valid.Gen.CdMethPay;
    else if (aName.startsWith("Upc")) owValid = Valid.Gen.Upc;
    else if (aName.startsWith("Dtl")) owValid = Valid.Gen.Addr;
    else throw Error(`Form wExec_Fld: Validator '${aName}' not found`);
  }
  // A custom validator was specified, or no validation is wanted:
  else owValid = aSpec.Valid;

  if (owValid) await owValid(aSpec);
}

// ----------------------------
// 'Structured' form processing
// ----------------------------
// Sometimes a set of similar records are edited simultaneously, as in the
// Producer Inventory page. Form data is inherently 'flat', yet the same fields
// are repeated in these pages, so it is necessary to suffix their names with an
// ID that makes them unique within the form, and that also identifies the
// records to which they belong. The basic field specification format does not
// support this directly because it is impossible to know at design time which
// IDs will be used in the rendered page.
//
// The Unroll function allows a fixed set of field specifications to be
// converted at form submission time into a new set that targets the fields in
// the form body. These 'unrolled' fields can then be validated with wExec, as
// normal. Next, the Roll function can be used to convert the validated,
// unrolled fields into a new set of structured data, with each Collect name
// producing a single object that maps IDs (drawn from the form input name
// suffixes, and attached by Unroll to the names of the Collect fields) to
// records that store all the validated specifications with the same ID and
// Collect name. A given record can then be passed to wIns or wUpd, just like
// any set of field specifications. Setting the fields in the base specification
// with different Collect values produces multiple collections in the rolled
// output, allowing multiple tables to be targeted with the same form.
//
// When designing the form, it must be remembered that the Collect fields will
// be suffixed automatically with numeric IDs. Other input names must not
// collide with these names, and the base names of the Collect fields must not
// end with numbers.
//
// It must also be remembered that an attacker could change ID suffixes in the
// form, causing them to references resources (such as products or varieties)
// that do not belong to the authenticated user. The POST controller must verify
// ownership of these resources before acting on the form submission.

/** The regex used to extract field names and IDs from form input collections. */
//
// We could separate ID components with underscores to allow those properties
// be referenced in JavaScript with the regular property syntax, but they begin
// with numbers, so they can't be referenced that way in the first place:
const PattRollNameAndID = /([A-Za-z]+)([\d-]+)/;

/** Returns new field specifications that duplicate and rename the generic
 *  Collect fields in aFlds to match the specific, ID-suffixed form values in
 *  aBody. A given field is duplicated once for every form input name that
 *  matches the base name, followed by a number. The new field uses the name
 *  found in the form, allowing the form data to be validated as usual. The
 *  string Collect value will later be used to name an object that references
 *  the collected validation results by the embedded IDs. Setting Collect to a
 *  a falsy value (or leaving it undefined) in the base field causes it to be
 *  copied to the new specification as-is, without duplication or any change to
 *  the name.
 *
 *  So, if aFlds is:
 *
 *    {
 *      CdUpd: { Valid: false },
 *      Qty: { CkRequire: true, Collect: "Vtys" },
 *      CkList: { Store: false, Collect: "Vtys" },
 *      Note: { Collect: "Producers" }
 *    }
 *
 * and if aBody is:
 *
 *    {
 *      CdUpd: "Ready",
 *      Qty101: "5",
 *      Qty102: "4",
 *      Qty103: "3",
 *      CkList101: "true",
 *      CkList102: "false",
 *      Note21: "Managed only",
 *      Note22: "Managed or unmanaged"
 *    }
 *
 * the result will be:
 *
 *    {
 *      CdUpd: { Valid: false },
 *      Qty101: { CkRequire: true, Collect: "Vtys" },
 *      Qty102: { CkRequire: true, Collect: "Vtys" },
 *      Qty103: { CkRequire: true, Collect: "Vtys" },
 *      CkList101: { Store: false, Collect: "Vtys" },
 *      CkList102: { Store: false, Collect: "Vtys" },
 *      Note21: { Collect: "Producers" },
 *      Note22: { Collect: "Producers" }
 *    }
 */
export function Unroll(aBody, aFlds) {
  // We could accept disabled fields here (somewhat like wExec) and ignore form
  // inputs that begin with the referenced names, but that would disable those
  // fields in every record. It is often necessary instead to consult record
  // properties when deciding whether to disable. For that reason, it seems
  // better to add the ID suffixes when compiling disabled fields, and pass them
  // to wExec, as usual.

  const oFldsUnroll = {};

  // Copy non-Collect fields
  // -----------------------

  for (const oNameFld in aFlds) {
    const oFld = aFlds[oNameFld];
    // Doesn't seem necessary to copy this object, but that could change:
    if (!oFld.Collect) oFldsUnroll[oNameFld] = oFld;
  }

  // Copy and expand Collect fields
  // ------------------------------

  for (const oNameIn in aBody) {
    // In the form, each field name starts with an alphabetic name, and ends
    // with an ID containing number digits and optional dashes.
    //
    // There should be a divider between the name and the ID so that names can
    // end with numbers: [TO DO]
    const oMatches = PattRollNameAndID.exec(oNameIn);
    if (!oMatches || oMatches.length != 3) continue;

    const oNameFld = oMatches[1];
    const oFld = aFlds[oNameFld];
    if (oFld === undefined || !oFld.Collect) continue;

    // It is necessary to clone this object:
    oFldsUnroll[oNameIn] = { ...oFld };
  }

  return oFldsUnroll;
}

/** Returns a new field specification that contains the validated specifications
 *  in aFldsUnroll, with all the fields sharing the same Collect and ID gathered
 *  into records, contained by an object named after the Collect, and keyed by
 *  ID. Collect fields in the original field specification that were not matched
 *  by actual form inputs will be undefined.
 *
 *  If the output from the Unroll example is passed to wExec, and if that output
 *  is then passed to this function, the result will be:
 *
 *    {
 *      CdUpd: { Valid: false },
 *      Vtys: {
 *        101: {
 *          Qty: {
 *            CkRequire: true, Conv: true, Store: true, Collect: "Vtys",
 *            ValRaw: "5", Valid: true, ValCook: 5
 *          },
 *          CkList: {
 *            CkRequire: false, Conv: true, Store: false, Collect: "Vtys",
 *            ValRaw: "true", Valid: true, ValCook: true
 *          }
 *        },
 *        102: { Qty: { ... }, CkList: { ... } },
 *        103: { Qty: { ... } }
 *      },
 *      Producers: {
 *        21: { Note: { ... } },
 *        22: { Note: { ... } }
 *      }
 *    }
 *
 * Take note of the fact that different Collect values produce different
 * collection objects, like Vtys and Producers in the example above. It is easy
 * to forget that multiple collections have been defined; if the wrong
 * collection object is then referenced in the POST handler, the field will be
 * undefined, just as if it had not been submitted. */
export function Roll(aFldsUnroll) {
  const oFldsRoll = {};
  for (const oNameFld in aFldsUnroll) {
    // Copy non-Collect fields
    // -----------------------

    const oFldUnroll = aFldsUnroll[oNameFld];
    const oCollect = oFldUnroll.Collect;
    // Doesn't seem necessary to copy this object, but that could change:
    if (!oCollect) {
      oFldsRoll[oNameFld] = oFldUnroll;
      continue;
    }

    // Aggregate Collect fields
    // ------------------------

    const oMatches = PattRollNameAndID.exec(oNameFld);
    if (!oMatches || oMatches.length != 3)
      throw Error(`Form Roll: Cannot parse field name '${oNameFld}'`);

    const oNameBase = oMatches[1];
    const oID = oMatches[2];

    // Create collection structure:
    if (oFldsRoll[oCollect] === undefined) oFldsRoll[oCollect] = {};
    if (oFldsRoll[oCollect][oID] === undefined) oFldsRoll[oCollect][oID] = {};

    // Store field:
    oFldsRoll[oCollect][oID][oNameBase] = oFldUnroll;
  }
  return oFldsRoll;
}

/** Uses one collection of data from a 'rolled' form output to produce an object
 *  containing records that store the 'cooked' values of the collection, with
 *  the records keyed by the collection IDs. This matches the general structure
 *  of the collection, with ValCook and other validation metadata removed from
 *  the middle.
 *
 *  If the collection contains CkHold and CtPend fields, the result might be:
 *
 *    {
 *      101: { CkHold: false, CtPend: null },
 *      102: { CkHold: true, CtPend: 2 },
 *      ...
 *    }
 *
 * This is the object equivalent of ElsFromCollect. */
export function RecsByIDFromCollect(aCollect) {
  const oRecsByID = {};
  for (const oID in aCollect) {
    const oRec = {};

    const oFlds = aCollect[oID];
    for (const oName in oFlds) oRec[oName] = oFlds[oName].ValCook;

    oRecsByID[oID] = oRec;
  }
  return oRecsByID;
}

/** Uses one collection of data from a 'rolled' form output to produce an array
 *  of records containing 'cooked' values, plus an aNameID property that stores
 *  the collection ID.
 *
 *  If the collection contains CkHold and CtPend fields, and if aNameID is 'ID',
 *  the result might be:
 *
 *    [
 *      { ID: 101, CkHold: false, CtPend: null },
 *      { ID: 102, CkHold: true, CtPend: 2 },
 *      ...
 *    ]
 *
 * This is the array equivalent of RecsByIDFromCollect. */
export function ElsFromCollect(aCollect, aNameID) {
  const oEls = [];
  for (const oID in aCollect) {
    const oEl = {};
    oEl[aNameID] = oID;

    const oFlds = aCollect[oID];
    for (const oNameFld in oFlds) oEl[oNameFld] = oFlds[oNameFld].ValCook;

    oEls.push(oEl);
  }
  return oEls;
}

/** Returns a new object that associates field names directly with ValCook
 *  values. */
export function ValsCookFromFlds(aFlds) {
  const oVals = {};
  for (const oName in aFlds) {
    const oVal = aFlds[oName].ValCook;
    if (oVal !== undefined) oVals[oName] = oVal;
  }
  return oVals;
}

/** Returns an object that contains the raw and cooked values of the specified
 *  field and collection, plus the first validation failure message associated
 *  with that field, or 'null' if there was no failure. Returns empty value
 *  arrays and a 'null' message if aCollect is falsy. */
export function ValsFromCollect(aCollect, aProp) {
  const oValsRaw = [];
  const oValsCook = [];
  let oMsgFail = null;

  if (aCollect)
    for (const oID in aCollect) {
      const oFld = aCollect[oID][aProp];
      // Don't break, we want the rest of the values:
      if (oFld.MsgFail && !oMsgFail) oMsgFail = oFld.MsgFail;

      oValsRaw.push(oFld.ValRaw);
      if (oFld.ValCook !== undefined) oValsCook.push(oFld.ValCook);
    }

  return {
    ValsRaw: oValsRaw,
    ValsCook: oValsCook,
    MsgFail: oMsgFail,
  };
}

/** Returns 'true' if any field directly contained by aFlds was found to be
 *  invalid. */
function CkFailFlat(aFlds) {
  for (const oName in aFlds) if (aFlds[oName].MsgFail) return true;
  return false;
}

/** Returns 'true' if any field was found to be invalid. Child properties of
 *  aFlds are checked, along with elements in the collection arrays named by
 *  aCollects, if any are specified. */
export function CkFail(aFlds, ...aCollects) {
  if (CkFailFlat(aFlds)) return true;

  for (const oCollect of aCollects) {
    const oRecsCollect = aFlds[oCollect];
    for (const oID in oRecsCollect) {
      const oFldsCollect = oRecsCollect[oID];
      if (oFldsCollect && CkFailFlat(oFldsCollect)) return true;
    }
  }

  return false;
}

/** Returns the failure message from the first field directly contained by aFlds
 *  that is found to be invalid, or 'null' if all are valid. */
function MsgFailFlat(aFlds) {
  for (const oName in aFlds) {
    const oMsg = aFlds[oName].MsgFail;
    if (oMsg) return oMsg;
  }
  return null;
}

/** Returns the failure message from the first field that is found to be
 *  invalid. Child properties of aFlds are checked, along with elements in the
 *  collection arrays named by aCollects, if any are specified. Returns 'null'
 *  if all fields are valid. */
export function MsgFail(aFlds, ...aCollects) {
  let oMsg = MsgFailFlat(aFlds);
  if (oMsg) return oMsg;

  for (const oCollect of aCollects) {
    const oRecsCollect = aFlds[oCollect];
    for (const oID in oRecsCollect) {
      const oFldsCollect = oRecsCollect[oID];
      if (!oFldsCollect) continue;

      oMsg = MsgFailFlat(oFldsCollect);
      if (oMsg) return oMsg;
    }
  }

  return null;
}

/** Marks the page 'invalid' and adds a flash message asking the user to try
 *  again. Also copies the original and sanitized form entries from aFlds to
 *  'locals', if aFlds is set, along with the validation failure messages. This
 *  is appropriate if the view data is 'flat'. */
//
//  Sometimes POST handlers invoke the GET handler after this is called, other
//  times they 'render' the view directly. Extra work may or may not be required
//  to prepare the view data before calling 'render'. It seems better to use the
//  GET handler wherever possible. The Work object in the request can be used to
//  forward the validated view data:
export function Retry(aResp, aFlds) {
  // Some controllers or views might choose to display the invalid page
  // differently:
  aResp.locals.zCkInvalid = true;

  if (aFlds) Fill(aResp.locals, aFlds);

  aResp.Show_Flash(
    "danger",
    "Attention!",
    "Some entries are missing or invalid. Please try again.",
  );
}

/** Copies the original and sanitized form entries from aFlds to aDest, along
 *  with the validation failure messages. */
export function Fill(aDest, aFlds) {
  for (const oNameFld in aFlds) {
    const oFld = aFlds[oNameFld];
    // Return the user's original input to the form, or the converted and
    // sanitized version, if possible. The converted version is preferable,
    // because the view might be expecting a particular type, but it might
    // also hide the problem that caused the field to be considered invalid.
    // If this happens, use the conversion code to record the type of the
    // field, and prefer the 'raw' version if it is text, and if validation
    // failed?:
    let oVal = oFld.ValCook === undefined ? oFld.ValRaw : oFld.ValCook;
    aDest[oNameFld] = oVal;

    if (oFld.MsgFail) aDest["MsgFail" + oNameFld] = oFld.MsgFail;
  }
}

/** Returns an object containing field values for which Store is 'true' or equal
 *  to aNameTbl. */
function ParamsStore(aNameTbl, aFlds) {
  const oParams = {};
  for (const oName in aFlds) {
    const oFld = aFlds[oName];
    if (oFld.Store === true || oFld.Store === aNameTbl) oParams[oName] = oFld.ValCook;
  }
  return oParams;
}

/** Uses form data to insert a record in the specified table, then returns the
 *  ID of the new record. aParamsEx defines additional name/value pairs to be
 *  used in the query. If database connection aConn is defined, it will be used
 *  to perform the query. Otherwise the default connection will be used. */
export async function wIns(aNameTbl, aFlds, aParamsEx, aConn) {
  if (!aConn) aConn = Conn;

  const oParams = ParamsStore(aNameTbl, aFlds);
  Object.assign(oParams, aParamsEx);

  const oNamesFld = Object.keys(oParams).join(", ");
  const oValsFld = Object.keys(oParams)
    .map(aName => `:${aName}`)
    .join(", ");

  let oSQL = `INSERT INTO ${aNameTbl} (${oNamesFld})
		VALUES (${oValsFld})`;

  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.insertId;
}

/** Uses form data to update records in the specified table. aNameWhere gives
 *  the name of the field in the WHERE clause, and aValWhere gives its value.
 *  aParamsEx defines additional name/value pairs to be used in the query. If
 *  database connection aConn is defined, it will be used to perform the query.
 *  Otherwise the default connection will be used. Returns the number of rows
 *  affected by the update. */
export async function wUpd(aNameTbl, aNameWhere, aValWhere, aFlds, aParamsEx, aConn) {
  if (!aConn) aConn = Conn;

  const oParams = ParamsStore(aNameTbl, aFlds);
  Object.assign(oParams, aParamsEx);

  const oPairs = Object.keys(oParams)
    .map(aName => `${aName} = :${aName}`)
    .join(", ");

  let oSQL = `UPDATE ${aNameTbl}
		SET ${oPairs}
		WHERE ${aNameWhere} = :${aNameWhere}`;

  // The SQL must be generated before this WHERE property is added. I don't want
  // to make yet another copy:
  oParams[aNameWhere] = aValWhere;

  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.affectedRows;
}

/** Updates the specified table with wUpd, throwing if fewer or more than one
 *  record was affected. */
export async function wUpdOne(aNameTbl, aNameWhere, aValWhere, aFlds, aParamsEx, aConn) {
  const oCt = await wUpd(aNameTbl, aNameWhere, aValWhere, aFlds, aParamsEx, aConn);
  if (oCt < 1) throw Error("Form wUpdOne: Failed to update record");
  if (oCt > 1) throw Error("Form wUpdOne: Updated too many records");
}

/** Updates the specified table with wUpd, throwing if fewer than one record was
 *  affected. */
export async function wUpdSome(aNameTbl, aNameWhere, aValWhere, aFlds, aParamsEx, aConn) {
  const oCt = await wUpd(aNameTbl, aNameWhere, aValWhere, aFlds, aParamsEx, aConn);
  if (oCt < 1) throw Error("Form wUpdSome: Failed to update record");
}

export async function wClearProductImages(aProductId) {
  const oSQL = `DELETE FROM ProductImage WHERE IDProduct = :IDProduct`;
  const oParams = { IDProduct: aProductId };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.affectedRows;
}

export async function wInsertProductImage(aProductId, aImageName, aDisplayOrder) {
  const oSQL = `INSERT INTO ProductImage (IDProduct, FileName, DisplayOrder) VALUES (:IDProduct, :FileName, :DisplayOrder)`;
  const oParams = {
    IDProduct: aProductId,
    FileName: aImageName,
    DisplayOrder: aDisplayOrder,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.insertId;
}

// ---------------------
// Form-level validation
// ---------------------

/** Deletes Size, or WgtMin and WgtMax, depending on whether aCkPriceVar is
 *  set. */
export function Upd_FldsVtyPriceVar(aFlds, aCkPriceVar) {
  if (aCkPriceVar) delete aFlds.Size;
  else {
    delete aFlds.WgtMin;
    delete aFlds.WgtMax;
  }
}

/** Validates WgtMin and WgtMax, or Size, depending on whether aCkPriceVar is
 *  set. */
export function Valid_FldsVtyPriceVar(aFlds, aCkPriceVar) {
  if (aCkPriceVar) {
    // Aren't these handled by 'Valid.Gen.Wgt'?: [TO DO]
    if (aFlds.WgtMin.ValCook < 0.01 || aFlds.WgtMin.ValCook > 99.9)
      aFlds.WgtMin.MsgFail = "Please enter a valid weight minimum.";
    if (aFlds.WgtMax.ValCook < 0.01 || aFlds.WgtMax.ValCook > 99.9)
      aFlds.WgtMax.MsgFail = "Please enter a valid weight maximum.";

    if (aFlds.WgtMin.ValCook > aFlds.WgtMax.ValCook)
      aFlds.WgtMin.MsgFail = "The weight minimum may not exceed the maximum.";
  } else {
    if (!aFlds.Size.ValCook) aFlds.Size.MsgFail = "Please enter a size.";
  }
}
