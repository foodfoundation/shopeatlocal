// View.js
// =======
// View rendering setup
//
// Helpers must not be defined with arrow functions, otherwise 'this' will take
// its meaning from the containing scope, instead of referencing the view
// context.

import Handlebars from "handlebars";
const { escapeExpression, SafeString } = Handlebars;

import {
  CdsStaff,
  CdsStaffAssign,
  CdsReg,
  CdsVtyType,
  CdsVtyTypeAbbrev,
  CdsStor,
  CdsListVtyValid,
  CdListVtyFromCks,
  CdsListVtyOnsiteOnly,
  CdsAttrProduct,
  CdsListVty,
  CdsTypeTransact,
  CdsMethPay,
  CdsTypeTransactStaff,
  CdsTypeLoc,
} from "./Db.js";
import gFeatureFlags from "./FeatureFlags.js";
import { Site, CoopParams, Locs } from "./Site.js";
import { CkDev, CkTest, ImageStoragePrefix, StaticStoragePrefix } from "../Cfg.js";
import {
  ReplaceAll,
  TextDateTimeInput,
  TextDateMed,
  TextDateLong,
  TextDateTimeMed,
  TextDateTimeLong,
  TextWhen,
  TextYesNo,
  TextPercent,
  TextCurr,
  TextPhoneOrOrig,
  Plural,
  TextIDMemb,
  TextIDProducer,
  TextIDCat,
  TextIDSubcat,
  TextIDProduct,
  TextIDVty,
  NameProductVty,
  NameVty,
  TextWgt,
  TextWgtEst,
  TextIDTransact,
  TextIDCyc,
  TextIDCart,
  TextIDInvcProducerWeb,
  TextIDInvcProducerOnsite,
  TextIDInvcShopWeb,
  TextIDInvcShopOnsite,
  JoinDefined,
  TextIDInvcTransact,
} from "./Util.js";

import { readFileSync } from "fs";
import { join } from "path";

import _ from "lodash";
const { capitalize, isNumber, round } = _;

// ------------
// View helpers
// ------------

/** Returns a version of aText that replaces angle braces and other HTML syntax
 *  characters with HTML-entity-equivalents, making it safe for inclusion in a
 *  page, while retaining tags in array aTagsSafe. The original text must not
 *  include the string 'TEMP_HTMLSafe_'. */
function HTMLSafe(aText, aTagsSafe) {
  const oPrefixTemp = "TEMP_HTMLSafe_";

  // Replace safe tags with temp strings:
  for (let o = 0; o < aTagsSafe.length; ++o) {
    const oNameTemp = oPrefixTemp + o;
    // Prevent the temp string from being injected:
    aText = ReplaceAll(aText, oNameTemp, "");
    aText = ReplaceAll(aText, aTagsSafe[o], oNameTemp);
  }

  // 'Escape' other HTML:
  aText = escapeExpression(aText);

  // Replace temp strings with safe tags:
  for (let o = 0; o < aTagsSafe.length; ++o) {
    const oNameTemp = oPrefixTemp + o;
    aText = ReplaceAll(aText, oNameTemp, aTagsSafe[o]);
  }

  // Prevent the result from being escaped later:
  return new SafeString(aText);
}

/** Returns a sequence of 'option' elements representing the aTexts values, with
 *  the element matching aTextSel selected. */
function HTMLOptsFromTexts(aTexts, aTextSel) {
  let oHTML = "";
  for (const oText of aTexts) {
    const oSel = oText === aTextSel ? " selected" : "";
    const oTextEsc = escapeExpression(oText);
    oHTML += `<option${oSel}>${oTextEsc}</option>\n`;
  }
  return new SafeString(oHTML);
}

/** Returns a sequence of 'option' elements representing the aCds code/text
 *  pairs, with the element matching aCdSel selected. Add an 'any' element with
 *  an empty string value if aCkAny is truthy. */
function HTMLOptsFromCds(aCds, aCdSel, aCkAny) {
  let oHTML = "";

  if (aCkAny) {
    const oSel = !aCdSel ? " selected" : "";
    oHTML += `<option value=""${oSel}>(any)</option>`;
  }

  for (const oCd in aCds) {
    const oSel = oCd === aCdSel ? " selected" : "";
    const oTextEsc = escapeExpression(aCds[oCd].Text);
    oHTML += `<option value="${oCd}"${oSel}>${oTextEsc}</option>`;
  }
  return new SafeString(oHTML);
}

// Debugging
// ---------

/** Returns a JSON representation of aObj. */
Handlebars.registerHelper("hJSON", function (aObj) {
  return JSON.stringify(aObj);
});

/** Returns a string representation of aVal, or "null" if it is null or
 *  undefined. */
Handlebars.registerHelper("hJSONValOrNull", function (aVal) {
  return aVal === null || aVal === undefined ? "null" : aVal.toString();
});

/** Returns "true" if aVal value is truthy, or "false" if it is not. */
Handlebars.registerHelper("hJSONBool", function (aVal) {
  return aVal ? "true" : "false";
});

// HTML
// ----

/** Escapes aStr for use in an HTML attribute. */
Handlebars.registerHelper("hAttr", function (aStr) {
  return escapeExpression(aStr);
});

/** Escapes aStr for use in an HTML element. */
Handlebars.registerHelper("hElem", function (aStr) {
  return escapeExpression(aStr);
});

// Strings
// -------

/** Returns aStr with its first character capitalized. */
Handlebars.registerHelper("hCapitalize", function (aStr) {
  return aStr.charAt(0).toUpperCase() + aStr.slice(1);
});

// Configuration
// -------------

/** Returns 'true' if this is a development server. */
Handlebars.registerHelper("hCkDev", function (_aName) {
  return CkDev === true;
});

/** Returns 'true' if this is a test server. */
Handlebars.registerHelper("hCkTest", function (_aName) {
  return CkTest === true;
});

/** Returns the named 'Site.js' property. */
Handlebars.registerHelper("hSite", function (aName) {
  return Site[aName];
});

// Comparisons and logic
// ---------------------

Handlebars.registerHelper("hCkNaN", function (aVal) {
  return isNaN(aVal);
});

Handlebars.registerHelper("hCkNull", function (aVal) {
  return aVal === null;
});

Handlebars.registerHelper("hCkNotNull", function (aVal) {
  return aVal !== null;
});

Handlebars.registerHelper("hNot", function (aVal) {
  return !aVal;
});

/** Accepts any number of parameters and returns the first truthy value, or
 *  'false' if there is no such. */
Handlebars.registerHelper("hCkOr", function (...aVals) {
  // Remove the Handlebars options parameter:
  aVals.pop();

  // We could use 'array.some', but that always returns a boolean. We sometimes
  // want the first truthy value instead:
  for (const oVal of aVals) if (oVal) return oVal;
  return false;
});

/** Accepts any number of parameters, and returns the last truthy value if all
 *  are truthy, or 'false' if any is falsy. */
Handlebars.registerHelper("hCkAnd", function (...aVals) {
  // Don't really know what is right here:
  if (aVals.length < 2) return true;

  // Remove the Handlebars options parameter:
  aVals.pop();

  // We could use 'array.every', but that always returns a boolean. We sometimes
  // want the last truthy value instead:
  for (const oVal of aVals) if (!oVal) return false;
  return aVals[aVals.length - 1];
});

/** Returns 'true' if the arguments are equal. */
Handlebars.registerHelper("hCkEq", function (aL, aR) {
  return aL === aR;
});

/** Returns 'true' if the arguments are not equal. */
Handlebars.registerHelper("hCkNotEq", function (aL, aR) {
  return aL !== aR;
});

Handlebars.registerHelper("hCkLess", function (aL, aR) {
  return aL < aR;
});

Handlebars.registerHelper("hCkLessEq", function (aL, aR) {
  return aL <= aR;
});

Handlebars.registerHelper("hCkGreater", function (aL, aR) {
  return aL > aR;
});

Handlebars.registerHelper("hCkGreaterEq", function (aL, aR) {
  return aL >= aR;
});

/** Returns aValL if aCk is truthy, or aValR if it is not. */
Handlebars.registerHelper("hIIf", function (aCk, aValL, aValR) {
  return aCk ? aValL : aValR;
});

/** Returns aText if aVal is truthy, and if it is not an empty array. Returns
 *  an empty string otherwise. */
Handlebars.registerHelper("hTextIf", function (aText, aVal) {
  // We are trying to match the Handlebars '#if' semantics, which are not quite
  // equivalent to JavaScript's notion of truthiness. Note that we probably do
  // want to support array-like objects:
  const oCk = aVal && (aVal.length === undefined || aVal.length > 0);
  return oCk ? aText : "";
});

/** Returns aText if aProp is falsy, or if it is an empty array. */
Handlebars.registerHelper("hTextUnless", function (aText, aVal) {
  // We are trying to match the Handlebars '#unless' semantics, which are not
  // quite equivalent to JavaScript's notion of truthiness. Note that we
  // probably do want to support array-like objects:
  const oCk = aVal && (aVal.length === undefined || aVal.length > 0);
  return oCk ? "" : aText;
});

/** Returns aHTML if aView is the current view. */
Handlebars.registerHelper("hTextIfView", function (aView, aText, aOpts) {
  // Why not make this a block helper? [TO DO]

  // 'view' returns paths with backslashes, even though Handlebars uses forward
  // slashes everywhere else:
  const oViewCurr = aOpts.data.exphbs.view.replace(/\\/, "/");
  return oViewCurr === aView ? new SafeString(aText) : "";
});

// Arithmetic
// ----------

/** Returns the sum of zero or more arguments. */
Handlebars.registerHelper("hSum", function (...aVals) {
  let oSum = 0;
  // Skip the Handlebars data object:
  for (let o = 0; o < aVals.length - 1; ++o)
    // Might be null:
    oSum += aVals[o] || 0;
  return oSum;
});

/** Returns the difference of two arguments. */
Handlebars.registerHelper("hDiff", function (aL, aR) {
  return aL - aR;
});

// Strings
// -------

/** Returns the string concatenation of zero or more arguments. */
Handlebars.registerHelper("hConcat", function (...aVals) {
  let oSum = "";
  // Skip the Handlebars data object:
  for (let o = 0; o < aVals.length - 1; ++o)
    // Might be null:
    oSum += aVals[o] || 0;
  return oSum;
});

/** Wraps the string in double quotes. */
Handlebars.registerHelper("hQuoteDbl", function (aText) {
  return '"' + aText + '"';
});

// Dates and times
// ---------------
// Perhaps the various 'hTextDate' and 'hTextDateTime' invocations should be
// replaced with 'hTextWhen', which is newer and more flexible?

/** Returns the current time. */
Handlebars.registerHelper("hNow", function () {
  return new Date();
});

/** Converts a Date into a user-time-zone ISO 8601 'yyyy-mm-ddThh:mm' string
 *  suitable for the value of a 'datetime-local' HTML input. */
Handlebars.registerHelper("hTextDateTimeInput", function (aDate) {
  if (!aDate) return "";
  return TextDateTimeInput(aDate);
});

/** Converts a Date into a 'MMM DD, YYYY' string. */
Handlebars.registerHelper("hTextDateMed", function (aDate) {
  if (!aDate) return "";
  return TextDateMed(aDate);
});

/** Converts a Date into a 'MMMM DD, YYYY' string. */
Handlebars.registerHelper("hTextDateLong", function (aDate) {
  if (!aDate) return "";
  return TextDateLong(aDate);
});

/** Converts a Date into a 'MMM DD, YYYY, h:mm AM/PM' string. */
Handlebars.registerHelper("hTextDateTimeMed", function (aDate) {
  if (!aDate) return "";
  return TextDateTimeMed(aDate);
});

/** Converts a Date into a 'MMMM DD, YYYY, h:mm AM/PM' string. */
Handlebars.registerHelper("hTextDateTimeLong", function (aDate) {
  if (!aDate) return "";
  return TextDateTimeLong(aDate);
});

/** Converts a Date to the format specified by aFmtDate and aFmtTime, these
 *  accepting the formats used with Util.TextWhen. */
Handlebars.registerHelper("hTextWhen", function (aWhen, aFmtDate, aFmtTime, aOpts) {
  if (!aWhen) return "";

  if (aOpts === undefined) {
    aOpts = aFmtTime;
    aFmtTime = undefined;
  }

  return TextWhen(aWhen, aFmtDate, aFmtTime);
});

// Context data
// ------------

/** Returns the context property specified by aName, after that value is
//  suffixed with aSuff. */
Handlebars.registerHelper("hPropSuffCurr", function (aName, aSuff) {
  return this[aName + aSuff];
});

/** Returns the root context property specified by aName, after that value is
//  suffixed with aSuff. */
Handlebars.registerHelper("hPropSuffRoot", function (aName, aSuff, aOpts) {
  return aOpts.data.root[aName + aSuff];
});

/** Reads and returns the named property from the top level of the context, or
 *  from the root, if it is not found in the top level. */
Handlebars.registerHelper("hPropCurrOrRoot", function (aName, aOpts) {
  if (this[aName] === undefined) return aOpts.data.root[aName];
  return this[aName];
});

/** Returns the result of the parameterless method aName, as invoked on aObj,
 *  or 'INVALID', if no such method is found. */
Handlebars.registerHelper("hMeth", function (aObj, aName) {
  const oFunc = aObj[aName];
  if (!oFunc || typeof oFunc !== "function") return "INVALID";
  return oFunc.bind(aObj)();
});

// Arrays
// ------

/** Returns the number of elements in array aEls, or 'undefined' if it is 'null'
 *  or 'undefined'. */
Handlebars.registerHelper("hLen", function (aEls) {
  return aEls ? aEls.length : undefined;
});

// Feature Flags
// ------

Handlebars.registerHelper("hCkFeatureFlag", function (aFeature) {
  if (CkDev) {
    return true;
  }

  if (CkTest) {
    return !!gFeatureFlags.testEnv[aFeature];
  }

  return !!gFeatureFlags.prodEnv[aFeature];
});

// General text
// ------------
// Helpers like 'hTextFixedOrOrig' that expect a particular type might be used
// in forms, which typically display the user's input after a validation
// failure. For this reason, they should return the original value if it cannot
// be converted.
//
// For similar reasons, most helpers return the empty string if their arguments
// are undefined, rather than an error string, which might be more useful for
// non-form elements.

/** Capitalizes aText. */
Handlebars.registerHelper("hCap", function (aText) {
  return capitalize(aText);
});

/** Upper-cases aText. */
Handlebars.registerHelper("hUpper", function (aText) {
  if (!aText) return "";
  return aText.toUpperCase();
});

/** Truncates a string at aLen, with an ellipsis if the string was changed. */
Handlebars.registerHelper("hTrunc", function (aText, aLen) {
  if (!aText || aText.length < aLen) return aText;

  aText = aText.substr(0, aLen);
  aText = aText.substr(0, aText.lastIndexOf(" "));
  if (aText.length && ".,-;&+".includes(aText[aText.length - 1]))
    aText = aText.substr(0, aText.length - 1);
  return aText + "...";
});

/** Replaces lines breaks and line break sequences with slashes, then truncates
 *  the string to aLen, adding an ellipsis if it was too long. */
Handlebars.registerHelper("hTruncSlash", function (aText, aLen) {
  if (!aText) return aText;

  let oText = aText.replace(/(\r\n|\r|\n)+/g, " / ");
  if (oText.length < aLen) return oText;

  oText = oText.substr(0, aLen);
  oText = oText.substr(0, oText.lastIndexOf(" "));
  if (oText.length && ".,-;&+".includes(oText[oText.length - 1]))
    oText = oText.substr(0, oText.length - 1);
  return oText + "...";
});

/** Returns "Yes" if aVal is truthy, or "No" if it is not, or the empty string
 *  if it is null or undefined. */
Handlebars.registerHelper("hYesNoBlank", function (aVal) {
  if (aVal === undefined || aVal === null) return "";
  return TextYesNo(aVal);
});

/** Formats aNum with aCtDig digits after the decimal place, if it is a number.
 *  Returns the original value if it is not a number. */
Handlebars.registerHelper("hTextFixedOrOrig", function (aNum, aCtDig) {
  if (aNum === undefined || aNum === null) return "";
  // Return the original input, in case of form validation failure:
  if (!isNumber(aNum)) return aNum;
  return Number(aNum).toFixed(aCtDig);
});

/** Formats aVal as a percent, if it is a number. Returns the original value if
 *  it is not a number. */
Handlebars.registerHelper("hTextPercentOrOrig", function (aVal, aCtDigitFrac) {
  if (aVal === undefined || aVal === null) return "";
  // Return the original input, in case of form validation failure:
  if (!isNumber(aVal)) return aVal;
  return TextPercent(aVal, aCtDigitFrac);
});

/** Formats aVal as currency, if it is a number. Returns the original value if
 *  it is not a number. */
Handlebars.registerHelper("hTextCurrOrOrig", function (aVal) {
  if (aVal === undefined || aVal === null) return "";
  // Return the original input, in case of form validation failure:
  if (!isNumber(aVal)) return aVal;
  return TextCurr(aVal);
});

/** Returns aVal formatted as currency, or 'ERROR' if it is not a number. */
Handlebars.registerHelper("hTextCurrOrErr", function (aVal) {
  if (!isNumber(aVal)) return "ERROR";
  return TextCurr(aVal);
});

/** Formats a phone number, or returns an empty string if aPhone is falsy. */
Handlebars.registerHelper("hTextPhoneOrOrig", function (aPhone) {
  return aPhone ? TextPhoneOrOrig(aPhone) : "";
});

// Grammar
// -------

/** Returns the plural form of a word, if aCt is not one. If aWordPlur is not
 *  provided, the plural will be formed by adding 's'.*/
Handlebars.registerHelper("hPlural", function (aCt, aWordSing, aWordPlur, aOpts) {
  if (aOpts === undefined) {
    aOpts = aWordPlur;
    aWordPlur = undefined;
  }

  return Plural(aCt, aWordSing, aWordPlur);
});

/** Returns the 'determiner' appropriate to aCredUser, capitalizing it if aCkCap
 *  is 'true', and if the determiner does not turn out to be the login name. */
Handlebars.registerHelper("hDeterminerUser", function (aCredUser, aCkCap, aOpts) {
  let oText;
  if (!aCredUser) oText = "your";
  else {
    const oRoot = aOpts.data.root;
    if (oRoot.CredUser && oRoot.CredUser.IDMemb === aCredUser.IDMemb) oText = "your";
    else {
      oText = aCredUser.NameLogin + "'s";
      aCkCap = false;
    }
  }

  if (aCkCap) oText = capitalize(oText);
  return oText;
});

// General HTML
// ------------

/** Returns a URL-encoded string. */
Handlebars.registerHelper("hEncodeURL", function (aText) {
  const oTextEncode = encodeURIComponent(aText);
  return new SafeString(oTextEncode);
});

/** Filters HTML from aText, except for basic tags like 'em' and 'strong'. */
Handlebars.registerHelper("hHTMLSafe", function (aText) {
  const oTagsSafe = ["<strong>", "</strong>", "<em>", "</em>"];
  return HTMLSafe(aText, oTagsSafe);
});

/** Returns aText with line breaks replaced with 'br' tags. */
Handlebars.registerHelper("hHTMLLinesBr", function (aText) {
  if (!aText) return aText;

  // For some reason, users add lots of extraneous line breaks:
  let oHTML = aText.replace(/(\r\n|\r|\n)/g, "<br>");
  oHTML = oHTML.replace(/(<br>)+/g, "<br>");
  if (oHTML.startsWith("<br>")) oHTML = oHTML.slice(4);
  // We do want space between paragraphs, and there is no straightforward way
  // to do that with a single break:
  oHTML = oHTML.replace(/(<br>)/g, "<br><br>");

  return new SafeString(oHTML);
});

/** Returns aText with line-break-delimited blocks wrapped in 'p' tags. */
Handlebars.registerHelper("hHTMLLinesP", function (aText) {
  if (!aText) return aText;

  // For some reason, users add lots of extraneous line breaks:
  let oHTML = "<p>" + aText.replace(/(\r\n|\r|\n)/g, "</p><p>") + "</p>";
  oHTML = oHTML.replace(/(<\/p><p>)+/g, "</p><p>");
  while (oHTML.startsWith("<p></p>")) oHTML = oHTML.slice(7);
  while (oHTML.endsWith("<p></p>")) oHTML = oHTML.substr(0, oHTML.length - 7);

  return new SafeString(oHTML);
});

/** Returns "checked" if aSt is truthy, or if aSt is undefined and aStDef is
 *  truthy. Returns an empty string otherwise. */
Handlebars.registerHelper("hAttrCk", function (aSt, aStDef) {
  if (aSt === undefined || aSt === null) aSt = aStDef;
  return aSt ? "checked" : "";
});

/** Returns "selected" if aOpt matches aOptSel, or the empty string if it does
 *  not. */
Handlebars.registerHelper("hAttrSel", function (aOpt, aOptSel) {
  return aOpt === aOptSel ? "selected" : "";
});

/** Returns a link to aURL. */
Handlebars.registerHelper("hLink", function (aURL) {
  const oURLEsc = escapeExpression(aURL);
  const oHTML = `<a href="${oURLEsc}">${oURLEsc}</a>`;
  return new SafeString(oHTML);
});

/** Returns a 'mailto' link to aEmail. */
Handlebars.registerHelper("hLinkEmail", function (aEmail) {
  const oEmailEsc = escapeExpression(aEmail);
  const oHTML = `<a href="mailto:${oEmailEsc}">${oEmailEsc}</a>`;
  return new SafeString(oHTML);
});

/** Returns e-mail link HTML, with custom link text and subject line. */
Handlebars.registerHelper("hLinkEmailFull", function (aEmail, aText, aSubj) {
  const oEmailEsc = escapeExpression(aEmail);
  const oTextEsc = escapeExpression(aText);
  const oQry = aSubj ? "?" + encodeURIComponent(aSubj) : "";
  const oHTML = `<a href="mailto:${oEmailEsc}${oQry}">${oTextEsc}</a>`;
  return new SafeString(oHTML);
});

/** Returns telephone link HTML. This should work when clicked from a phone. */
Handlebars.registerHelper("hLinkPhone", function (aPhone) {
  const oPhoneEsc = escapeExpression(aPhone);
  const oHTML = `<a href="tel:+1${oPhoneEsc}">${TextPhoneOrOrig(oPhoneEsc)}</a>`;
  return new SafeString(oHTML);
});

// Form validation
// ---------------

/** Returns 'is-invalid' if there is a validation failure message for the
 *  referenced field. The message property name is expected to begin with
 *  'MsgFail', followed by aNameFld and aID and aIdx, if these are defined. */
Handlebars.registerHelper("hClassValidFail", function (aNameFld, aID, aIdx, aOpts) {
  if (aOpts === undefined) {
    aOpts = aIdx;
    aIdx = undefined;
  }
  if (aOpts === undefined) {
    aOpts = aID;
    aID = undefined;
  }

  let oNameMsgFail = "MsgFail" + aNameFld;
  if (aID !== undefined) oNameMsgFail += aID;
  if (aIdx !== undefined) oNameMsgFail += "-" + aIdx;

  if (aOpts.data.root[oNameMsgFail]) return "is-invalid";
});

/** Returns field-specific validation failure feedback HTML for aMsg, if it is
 *  defined. This element must be a sibling of the 'is-invalid' element, or
 *  Bootstrap will not display it. */
Handlebars.registerHelper("hDivMsgFail", function (aMsg) {
  if (!aMsg) return "";

  const oMsgEsc = escapeExpression(aMsg);
  return new SafeString(`<div class="invalid-feedback mb-2">${oMsgEsc}</div>`);
});

/** Returns form-level validation failure feedback HTML for aMsg, if it is
 *  defined. This element can be placed anywhere in the page. */
Handlebars.registerHelper("hDivMsgFailForm", function (aMsg) {
  if (!aMsg) return "";

  const oMsgEsc = escapeExpression(aMsg);
  return new SafeString(`<div class="text-danger"><small>${oMsgEsc}</small></div>`);
});

// Disabled form fields
// --------------------
// Fields can be disabled in supporting forms by adding a FldsDisab object to
// the context root, with property names in that object referencing the disabled
// fields. Each property should reference an object that contains an optional
// Msg string property, to be displayed with hMsgFldDisab or hDivMsgFldDisab.
//
// The same object can be passed to Form wExec to cause the disabled fields to
// be ignored when form data is processed.

/** Returns the 'disabled' attribute if field aName is referenced by FldsDisab.
 *  If aSuff is defined, it will be added to aName before FldsDisab is checked. */
Handlebars.registerHelper("hAttrFldDisab", function (aName, aSuff, aOpts) {
  if (!aOpts) {
    aOpts = aSuff;
    aSuff = undefined;
  }

  if (aSuff) aName += aSuff;

  const oFld = aOpts.data.root.FldsDisab;
  // Disabled fields typically provide messages, but an empty object should
  // disable the field nonetheless:
  return oFld && oFld[aName] !== undefined ? "disabled" : "";
});

/** Returns the disabled message for field aName, if it is referenced by
 *  FldsDisab. */
Handlebars.registerHelper("hMsgFldDisab", function (aName, aOpts) {
  // This should support 'aSuff', as above. [TO DO]

  const oFlds = aOpts.data.root.FldsDisab;
  return oFlds && oFlds[aName] && oFlds[aName].Msg;
});

/** Returns 'div' HTML for the specified disabled field message, if aName is
 *  referenced by FldsDisab. */
Handlebars.registerHelper("hDivMsgFldDisab", function (aName, aClass, aOpts) {
  // This should support 'aSuff', as above. [TO DO]

  if (aOpts === undefined) {
    aOpts = aClass;
    aClass = "";
  }

  const oFlds = aOpts.data.root.FldsDisab;
  const oMsg = oFlds && oFlds[aName] && oFlds[aName].Msg;
  if (!oMsg) return "";

  // Why not specify 'italic' in the Explain class instead?: [TO DO]
  return new SafeString(`<div class="Explain font-italic ${aClass}">${oMsg}</div>`);
});

// General HTML
// ------------------

/** Returns 'Disab' if aCk is truthy. */
Handlebars.registerHelper("hClassDisab", function (aCk) {
  return aCk ? "Disab" : "";
});

/** Returns 'Disab' if the user lacks accounting privileges. */
Handlebars.registerHelper("hClassDisabLackAccts", function (aOpts) {
  return aOpts.data.root.CredUser && aOpts.data.root.CredUser.CkStaffAccts() ? "" : "Disab";
});

/** Returns 'Disab' if the user lacks manager privileges. */
Handlebars.registerHelper("hClassDisabLackMgr", function (aOpts) {
  return aOpts.data.root.CredUser && aOpts.data.root.CredUser.CkStaffMgr() ? "" : "Disab";
});

/** Returns 'Disab' if the user lacks superuser privileges. */
Handlebars.registerHelper("hClassDisabLackSuper", function (aOpts) {
  return aOpts.data.root.CredUser && aOpts.data.root.CredUser.CkStaffSuper() ? "" : "Disab";
});

/** Uses the index and the element count to return CornerBtmLeft2,
//  CornerBtmLeft3, CornerBtmRight2, and CornerBtmRight3 classes that allow the
//  outside corners of two- and three-column grid layouts to be rounded. */
Handlebars.registerHelper("hClassCornerBtm", function (aIdx, aEls) {
  let oClasses = "";

  const oNum = aIdx + 1;
  if (aEls.length - oNum < 2 && oNum % 2 === 1) oClasses += "CornerBtmLeft2 ";
  if (aEls.length - oNum < 3 && oNum % 3 === 1) oClasses += "CornerBtmLeft3 ";
  if (oNum === aEls.length) {
    if (!(oNum % 2)) oClasses += "CornerBtmRight2 ";
    if (!(oNum % 3)) oClasses += "CornerBtmRight3 ";
  }
  return oClasses;
});

/** Returns search paging button HTML. The button will be disabled if the path
 *  is undefined. */
Handlebars.registerHelper("hBtnPageSearch", function (aPath, aText) {
  const oTextEsc = escapeExpression(aText);

  let oHTML;
  if (aPath) oHTML = `<a class="btn btn-primary" href="${aPath}">${oTextEsc}</a>`;
  else oHTML = `<a class="btn btn-primary disabled" href="#">${oTextEsc}</a>`;
  return new SafeString(oHTML);
});

// Staff
// -----

/** Returns 'true' if aCdStaff specifies a manager. */
Handlebars.registerHelper("hCkStaffMgrFromCd", function (aCdStaff) {
  return aCdStaff === "StaffMgr" || aCdStaff === "StaffSuper";
});

/** Returns 'true' if aCdStaff specifies a superuser. */
Handlebars.registerHelper("hCkStaffSuperFromCd", function (aCdStaff) {
  return aCdStaff === "StaffSuper";
});

/** Returns 'true' if the user is a staff member. */
Handlebars.registerHelper("hCkStaffFromUser", function (aOpts) {
  return aOpts.data.root.CredUser && aOpts.data.root.CredUser.CkStaff();
});

/** Returns 'true' if the user is a manager. */
Handlebars.registerHelper("hCkStaffMgrFromUser", function (aOpts) {
  return aOpts.data.root.CredUser && aOpts.data.root.CredUser.CkStaffMgr();
});

/** Returns text describing a staff code. */
Handlebars.registerHelper("hTextCdStaff", function (aCd) {
  if (aCd === undefined || aCd === null) return "";
  const oData = CdsStaff[aCd];
  return oData ? oData.Text : "INVALID";
});

Handlebars.registerHelper("hOptsCdStaffAssign", function (aCdSel) {
  return HTMLOptsFromCds(CdsStaffAssign, aCdSel);
});

// Members and producers
// ---------------------

/** Returns 'true' if Producer is Wholesale */
Handlebars.registerHelper("hCkProducerWholesale", function (aOpts) {
  return (
    aOpts.data.root.CredUser.CdRegWholesale === "Approv" ||
    aOpts.data.root.CredImperUser.CdRegWholesale === "Approv"
  );
});

/** Returns 'true' if Producer is Wholesale */
Handlebars.registerHelper("hCkStaffOrWholesale", function (aOpts) {
  return (
    (aOpts.data.root.CredUser && aOpts.data.root.CredUser.CkStaff()) ||
    aOpts.data.root.CredUser.CdRegWholesale === "Approv"
  );
});

/** Returns text describing a registration code. */
Handlebars.registerHelper("hTextCdReg", function (aCd) {
  if (aCd === undefined || aCd === null) return "";
  const oData = CdsReg[aCd];
  return oData ? oData.Text : "INVALID";
});

Handlebars.registerHelper("hOptsCdReg", function (aCdRegSel) {
  return HTMLOptsFromCds(CdsReg, aCdRegSel);
});

Handlebars.registerHelper("hOptsCdVtyType", function (aCdVtySel) {
  return HTMLOptsFromCds(CdsVtyType, aCdVtySel);
});

Handlebars.registerHelper("hOptsCdVtyTypeAbbrev", function (aCdVtySel) {
  return CdsVtyTypeAbbrev[aCdVtySel]?.Text || "";
});

/** Formats a member ID. */
Handlebars.registerHelper("hTextIDMemb", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDMemb(aID);
});

/** Returns 'true' if aMemb is EBT-elible. */
Handlebars.registerHelper("hCkRegEBT", function (aMemb) {
  return aMemb.CdRegEBT === "Approv";
});

/** Formats a producer ID. */
Handlebars.registerHelper("hTextIDProducer", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDProducer(aID);
});

/** Returns text describing a producer listing status. */
Handlebars.registerHelper("hTextCkListProducer", function (aCk) {
  return aCk ? "Listed" : "Unlisted";
});

Handlebars.registerHelper("hOptsHowHear", function (aTextSel) {
  const oTexts = [
    "Flyer",
    "Local Business or Organization",
    "Event or Presentation",
    "Friend or Family",
    "Gift Membership",
    "Newspaper or Radio",
    "Internet Search",
    "Social Media",
    "Visited the Storefront",
  ];
  return HTMLOptsFromTexts(oTexts, aTextSel);
});

/** Returns a PayPal payment description that references aMemb. */
Handlebars.registerHelper("hDescPayPal", function (aMemb) {
  return (
    `${CoopParams.CoopNameShort} balance for member ${TextIDMemb(aMemb.IDMemb)}, ` +
    `${aMemb.Name1First} ${aMemb.Name1Last}`
  );
});

// Products and varieties
// ----------------------

/** Formats a category ID. */
Handlebars.registerHelper("hTextIDCat", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDCat(aID);
});

/** Formats a subcategory ID. */
Handlebars.registerHelper("hTextIDSubcat", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDSubcat(aID);
});

/** Formats a product ID. */
Handlebars.registerHelper("hTextIDProduct", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDProduct(aID);
});

/** Formats a variety ID. */
Handlebars.registerHelper("hTextIDVty", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDVty(aID);
});

/** Returns text describing a product storage code. */
Handlebars.registerHelper("hTextCdStor", function (aCd) {
  if (aCd === undefined || aCd === null) return "";
  const oData = CdsStor[aCd];
  return oData ? oData.Text : "INVALID";
});

/** Returns variety listing code options HTML appropriate for the variety and
 *  user. */
Handlebars.registerHelper("hOptsCdListVty", function (aVty, aOpts) {
  const oCkStaff = aOpts.data.root.CredUser.CkStaff();
  const oCds = CdsListVtyValid(aVty, oCkStaff);
  const oCdSel = CdListVtyFromCks(aVty);
  return HTMLOptsFromCds(oCds, oCdSel);
});

/** Returns variety listing code options HTML appropriate for the variety and
 *  user. */
Handlebars.registerHelper("hOptsCdListWholesaleVty", function (aVty) {
  const oCds = CdsListVtyOnsiteOnly;
  const oCdSel = CdListVtyFromCks(aVty);
  return HTMLOptsFromCds(oCds, oCdSel);
});

/** Returns storage code options HTML. */
Handlebars.registerHelper("hOptsCdStor", function (aCdSel) {
  return HTMLOptsFromCds(CdsStor, aCdSel);
});

/** Returns text describing a product attribute. */
Handlebars.registerHelper("hTextAttrProduct", function (aCd) {
  if (aCd === undefined || aCd === null) return "";

  const oData = CdsAttrProduct[aCd];
  return oData ? oData.Text : "INVALID";
});

/** Returns text describing a variety listing and archive status. */
Handlebars.registerHelper("hTextListVty", function (aVty) {
  if (
    !aVty ||
    aVty.CkListWeb === undefined ||
    aVty.CkListOnsite === undefined ||
    aVty.CkArchiv === undefined
  ) {
    return "";
  }

  const oCd = CdListVtyFromCks(aVty);
  const oData = CdsListVty[oCd];
  return oData ? oData.Text : "ERROR";
});

/** Returns 'true' if the specified variety listing code indicates that the
 *  variety is listed. */
Handlebars.registerHelper("hCkListVty", function (aCd) {
  return aCd !== "Unlist" && aCd !== "Archiv";
});

Handlebars.registerHelper("hCdListBasicVty", function (aVty) {
  const oCd = CdListVtyFromCks(aVty);
  if (oCd === "Unlist" || oCd === "Archiv") return oCd;
  return "List";
});

/** Returns the combined product and variety name. */
Handlebars.registerHelper("hNameProductVty", function (aProduct, aVty) {
  return NameProductVty(aProduct, aVty);
});

/** Returns the variety name. */
Handlebars.registerHelper("hNameVty", function (aVty) {
  return NameVty(aVty);
});

/** Returns 'true' if aProduct bears any attribute. */
Handlebars.registerHelper("hCkAttrProduct", function (aProduct) {
  // Would be a lot easier if these fields were part of a set:
  return (
    aProduct.CkAttrVegan ||
    aProduct.CkAttrVeget ||
    aProduct.CkAttrGlutenFreeCert ||
    aProduct.CkAttrFairTradeCert ||
    aProduct.CkAttrOrganCert ||
    aProduct.CkAttrNaturGrownCert ||
    aProduct.CkAttrNaturGrownSelf ||
    aProduct.CkAttrIntegPestMgmtSelf ||
    aProduct.CkAttrAnimWelfareCert ||
    aProduct.CkAttrFreeRgSelf ||
    aProduct.CkAttrCageFreeSelf ||
    aProduct.CkAttrGrassFedSelf ||
    aProduct.CkAttrHormAntibFreeSelf
  );
});

/** Formats aVal as an item weight, if it is a number. Returns the original
 *  value if it is not a number. */
Handlebars.registerHelper("hTextWgtOrOrig", function (aVal) {
  // If the user enters a weight that is slightly less than the minimum for some
  // field, this helper will round it up to the minimum when the validation
  // failure is displayed. I'm not sure how to address that, except to pass the
  // validation state to the helper and bypass the formatting when a failure has
  // occurred. This isn't a big deal right now, and a proper solution would be
  // more general than that, so we will skip it for now. [TO DO]

  if (aVal === undefined || aVal === null) return "";
  // Return the original input, in case of form validation failure:
  if (!isNumber(aVal)) return aVal;
  return TextWgt(aVal);
});

/** Returns Size or weight range text for aVty. */
Handlebars.registerHelper("hTextSizeRgWgtVty", function (aVty) {
  if (!aVty.WgtMin) return aVty.Size;

  const oMin = round(aVty.WgtMin, 1);
  const oMax = round(aVty.WgtMax, 1);
  if (oMin === oMax) return "~" + oMin + Plural(oMin, " lb");

  return `${oMin}-${oMax} lbs`;
});

/** Returns estimated item weight text for aVty. */
Handlebars.registerHelper("hTextWgtEst", function (aVty) {
  return TextWgtEst(aVty);
});

/** Returns 'true' if the specified variety can be added to the cart. */
Handlebars.registerHelper("hCkAvailVty", function (aVty) {
  return aVty.CkListWeb && aVty.QtyOffer > aVty.QtyProm;
});

/** Returns the number of the specified variety that is available to be added to
 *  a cart. */
Handlebars.registerHelper("hQtyAvailAdd", function (aVty) {
  // Seems confusing to return zero when unlisted: [TO DO]
  return aVty.CkListWeb ? Math.max(aVty.QtyOffer - aVty.QtyProm, 0) : 0;
});

/** Returns the number of the specified variety that is available for a
 *  shopper's cart, including the number already in the cart. */
Handlebars.registerHelper("hQtyAvailTtl", function (aQtyOffer, aQtyPromVty, aQtyPromCart) {
  return Math.max(aQtyOffer - aQtyPromVty + aQtyPromCart, 0);
});

// Transactions
// ------------

/** Formats a transaction ID. */
Handlebars.registerHelper("hTextIDTransact", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDTransact(aID);
});

/** Returns text describing a transaction type code. */
Handlebars.registerHelper("hTextCdTypeTransact", function (aCd) {
  if (aCd === undefined || aCd === null) return "";
  const oData = CdsTypeTransact[aCd];
  return oData ? oData.Text : "INVALID";
});

/** Returns text describing a payment method code. */
Handlebars.registerHelper("hTextCdMethPay", function (aCd) {
  if (aCd === undefined || aCd === null) return "";
  const oData = CdsMethPay[aCd];
  return oData ? oData.Text : "INVALID";
});

/** Returns a formatted transaction amount. */
Handlebars.registerHelper("hTextAmtTransact", function (aTransact) {
  if (aTransact === undefined || aTransact === null) return "";
  const oAmt = aTransact.AmtMoney + aTransact.AmtEBT;
  return TextCurr(oAmt);
});

/** Returns the formatted money transaction amount. */
Handlebars.registerHelper("hTextAmtMoneyTransact", function (aTransact) {
  if (aTransact === undefined || aTransact === null) return "";
  return TextCurr(aTransact.AmtMoney);
});

/** Returns the formatted EBT transaction amount. */
Handlebars.registerHelper("hTextAmtEBTTransact", function (aTransact) {
  if (aTransact === undefined || aTransact === null) return "";
  return TextCurr(aTransact.AmtEBT);
});

Handlebars.registerHelper("hOptsCdTypeTransactOrAny", function (aCdSel) {
  return HTMLOptsFromCds(CdsTypeTransact, aCdSel, true);
});

Handlebars.registerHelper("hOptsCdTypeTransactStaff", function (aCdSel) {
  return HTMLOptsFromCds(CdsTypeTransactStaff, aCdSel);
});

Handlebars.registerHelper("hOptsCdMethPay", function (aCdSel) {
  return HTMLOptsFromCds(CdsMethPay, aCdSel);
});

Handlebars.registerHelper("hOptsCdMethPayOrAny", function (aCdSel) {
  return HTMLOptsFromCds(CdsMethPay, aCdSel, true);
});

// Miscellaneous
// -------------------

/** Returns the name of the specified location. */
Handlebars.registerHelper("hNameLocFromCd", function (aCdLoc) {
  if (aCdLoc === undefined || aCdLoc === null) return "";
  const oLoc = Locs[aCdLoc];
  return oLoc ? oLoc.NameLoc : "INVALID";
});

/** Returns text describing a location type. */
Handlebars.registerHelper("hTextTypeLoc", function (aCd) {
  if (aCd === undefined || aCd === null) return "";
  const oLoc = CdsTypeLoc[aCd];
  return oLoc ? oLoc.Text : "INVALID";
});

/** Formats a cycle ID. */
Handlebars.registerHelper("hTextIDCyc", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDCyc(aID);
});

/** Formats a cart ID. */
Handlebars.registerHelper("hTextIDCart", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDCart(aID);
});

/** Formats a web producer invoice ID. */
Handlebars.registerHelper("hTextIDInvcProducerWeb", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDInvcProducerWeb(aID);
});

/** Formats an on-site producer invoice ID. */
Handlebars.registerHelper("hTextIDInvcProducerOnsite", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDInvcProducerOnsite(aID);
});

/** Formats a web shopper invoice ID. */
Handlebars.registerHelper("hTextIDInvcShopWeb", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDInvcShopWeb(aID);
});

/** Formats a on-site shopper invoice ID. */
Handlebars.registerHelper("hTextIDInvcShopOnsite", function (aID) {
  if (aID === undefined || aID === null) return "";
  return TextIDInvcShopOnsite(aID);
});

Handlebars.registerHelper("hURLInvcShopWeb", function (aIDInvc) {
  if (aIDInvc === undefined || aIDInvc === null) return "";
  return "/web-shopper-invoice/" + aIDInvc;
});

Handlebars.registerHelper("hURLInvcShopOnsite", function (aIDInvc) {
  if (aIDInvc === undefined || aIDInvc === null) return "";
  return "/on-site-shopper-invoice/" + aIDInvc;
});

// Paths and routes
// ----------------

/** Returns aPath with a route parameter that selects the member selected in
 *  this request, if any. Returns the path unmodified if no member is selected. */
Handlebars.registerHelper("hPathMembSel", function (aPath) {
  return this.CredSel && this.CredSel.IDMemb ? aPath + `/${this.CredSel.IDMemb}` : aPath;
});

/** Returns aPath with a route parameter that selects the producer selected in
 *  this request, if any. Returns the path unmodified if no producer is
 *  selected. */
Handlebars.registerHelper("hPathProducerSel", function (aPath) {
  return this.CredSel && this.CredSel.IDProducer ? aPath + `/${this.CredSel.IDProducer}` : aPath;
});

/** Returns a Member Detail link. */
Handlebars.registerHelper("hLinkDtlMemb", function (aID) {
  if (!aID) return "";

  const oParamID = escapeExpression(aID);
  const oTextID = TextIDMemb(aID);
  const oHTML = `<a href="/member-detail/${oParamID}">Member ${oTextID}</a>`;
  return new SafeString(oHTML);
});

/** Returns a Producer Detail link. */
Handlebars.registerHelper("hLinkDtlProducer", function (aID) {
  if (!aID) return "";

  const oParamID = escapeExpression(aID);
  const oTextID = TextIDProducer(aID);
  const oHTML = `<a href="/producer-detail/${oParamID}">Producer ${oTextID}</a>`;
  return new SafeString(oHTML);
});

/** Returns a product attribute link. */
Handlebars.registerHelper("hLinkAttrProduct", function (aCd) {
  if (!aCd) return "";

  const oData = CdsAttrProduct[aCd];
  if (!oData) return "";

  const oTextEsc = escapeExpression(oData.Text);
  const oHTML = `<a href="/product-search?Ck${aCd}=true">${oTextEsc}</a>`;
  return new SafeString(oHTML);
});

/** Returns aPath with a route parameter that selects the product that was
 *  selected in this request, if any. Returns the path unmodified if no product
 *  is selected. */
Handlebars.registerHelper("hPathProductSel", function (aPath) {
  return this.ProductSel ? aPath + `/${this.ProductSel.IDProduct}` : aPath;
});

/** Returns aPath with a route parameter that selects the variety
 *  that was selected in this request, if any. Returns the path unmodified if no
 *  variety is selected. */
Handlebars.registerHelper("hPathVtySel", function (aPath) {
  return this.VtySel ? aPath + `/${this.VtySel.IDVty}` : aPath;
});

/** Returns e-mail link HTML, with a subject line referencing the specified
 *  variety. */
Handlebars.registerHelper("hLinkEmailVty", function (aMemb, aNameProduct, aKindVty, aSizeVty) {
  const oEmailEsc = escapeExpression(aMemb.Email1);

  const oVty = JoinDefined(", ", aNameProduct, aKindVty, aSizeVty);
  const oSubj = `Your ${CoopParams.CoopNameShort} order of '${oVty}'`;
  const oQry = "?subject=" + encodeURIComponent(oSubj);

  const oText = TextIDMemb(aMemb.IDMemb) + " " + aMemb.Name1First + " " + aMemb.Name1Last;
  const oTextEsc = escapeExpression(oText);

  const oHTML = `<a href="mailto:${oEmailEsc}${oQry}">${oTextEsc}</a>`;
  return new SafeString(oHTML);
});

/** Returns the path to the specified web producer invoice, or the empty string
 *  if aIDInvc is null or undefined. */
Handlebars.registerHelper("hPathInvcProducerWeb", function (aIDInvc) {
  if (aIDInvc === undefined || aIDInvc === null) return "";
  return "/web-producer-invoice/" + aIDInvc;
});

/** Returns the path to the specified on-site producer invoice, or the empty
 *  string if aIDInvc is null or undefined. */
Handlebars.registerHelper("hPathInvcProducerOnsite", function (aIDInvc) {
  if (aIDInvc === undefined || aIDInvc === null) return "";
  return "/on-site-producer-invoice/" + aIDInvc;
});

/** Returns a link to the invoice associated with aTransact. */
Handlebars.registerHelper("hLinkInvcTransact", function (aTransact) {
  let oAddr;
  let oText;
  switch (aTransact.CdTypeTransact) {
    case "EarnInvcProducerWeb":
      oAddr = "web-producer-invoice";
      oText = "Web producer invoice";
      break;
    case "EarnInvcProducerOnsite":
      oAddr = "on-site-producer-invoice";
      oText = "On-site retail producer invoice";
      break;
    case "EarnInvcProducerOnsiteWholesale":
      oAddr = "on-site-producer-invoice";
      oText = "On-site wholesale producer invoice";
      break;
    case "ChargeInvcShopWeb":
      oAddr = "web-shopper-invoice";
      oText = "Web shopper invoice";
      break;
    case "ChargeInvcShopOnsite":
      oAddr = "on-site-shopper-invoice";
      oText = "On-site shopper invoice";
      break;
    case "ChargeInvcShopOnsiteWholesale":
      oAddr = "on-site-shopper-invoice";
      oText = "On-site wholesale shopper invoice";
      break;
    default:
      return "";
  }
  const oTextID = TextIDInvcTransact(aTransact.IDInvc, aTransact.CdTypeTransact);
  const oHTML = `<a href="/${oAddr}/${aTransact.IDInvc}">${oText} ${oTextID}</a>`;
  return new SafeString(oHTML);
});

/** Returns true if the cart type is Wholesale */
Handlebars.registerHelper("hIsWholesaleType", function (aCdType) {
  return aCdType === "Wholesale";
});

/** Returns true if the cart type is Wholesale */
Handlebars.registerHelper("hIsRetailType", function (aCdCType) {
  return aCdCType === "Retail";
});

// -------------
// Block helpers
// -------------

/** Repeats the contained block aCt times. */
Handlebars.registerHelper("hRep", function (aCt, aOpts) {
  let oOut = "";
  for (let o = 0; o < aCt; ++o) oOut += aOpts.fn(this);
  return oOut;
});

/** Adds a property with the specified name to the root context. The first time
 *  it is called, the property is set to a value of one. Thereafter, its value
 *  is incremented once with each call. This can be used to generate unique IDs
 *  when hRep is used inside an 'each' helper. */
Handlebars.registerHelper("hIncr_Num", function (aName, aOpts) {
  const oObj = aOpts.data.root;
  // We'll start at one so that defined values are always truthy:
  if (oObj[aName] === undefined) oObj[aName] = 1;
  else ++oObj[aName];
});

/** Returns the block wrapped by this helper if the property specified by aName
 *  changes in the current record. Returns nothing if the property has not
 *  changed. This can be used to group sorted data. */
Handlebars.registerHelper("hOnChange", function (aName, aOpts) {
  const oRoot = aOpts.data.root;
  // Adding 'loc.start.line' makes the key for each hOnChange block unique.
  // Without this, a given context property could be referenced only once per
  // 'each' record, with all later references being ignored. 'loc.start.line'
  // appears to be undocumented, so who knows whether we can rely on it
  // however:
  const oNameLast = `z${aName}Last${aOpts.loc.start.line}`;
  if (this[aName] === oRoot[oNameLast]) return aOpts.inverse(this);

  oRoot[oNameLast] = this[aName];
  return aOpts.fn(this);
});

Handlebars.registerHelper("hPrefixImageWithStorage", function (aImageName) {
  return `${ImageStoragePrefix}/${aImageName}`;
});

Handlebars.registerHelper("hPrefixStatic", function (aFileName) {
  return `${StaticStoragePrefix}/${aFileName}`;
});

// -------
// Exports
// -------

import { engine, create } from "express-handlebars";

/** Configures view rendering with Handlebars. */
export function Ready(aApp) {
  aApp.set("views", "src/Page");

  // Use the 'hbs' file extension:
  aApp.engine(
    ".hbs",
    engine({
      extname: ".hbs",
      layoutsDir: "src/Lay",
      defaultLayout: "Main",
      // There is no reason to view all the partials together, so we will mix them
      // with the view templates, and organize these (along with the controllers)
      // by functionality:
      partialsDir: "src/Page",
      compilerOptions: {
        // This fixes an idiotic Handlebars problem that caused the tab characters
        // preceding a partial invocation:
        //
        //   {{>Product/pCtlsFormProduct}}
        //
        // to be included in every line of the HTML produced by the partial. This
        // in turn caused that number of tabs to be inserted into the *content* of
        // 'textarea' tags, if they happened to include line breaks. See here for
        // details:
        //
        //   https://github.com/handlebars-lang/handlebars.js/issues/858
        //
        preventIndent: true,
      },
    }),
  );
  aApp.set("view engine", ".hbs");

  var hbs = create({});

  hbs.handlebars.registerHelper("json", function (context) {
    return JSON.stringify(context).replace(/"/g, "&quot;");
  });
  hbs.handlebars.registerHelper("json2", function (context) {
    return JSON.stringify(context);
  });
  hbs.handlebars.registerHelper("log", function (something) {
    console.log(something);
  });
  hbs.handlebars.registerHelper("logparse", function (something) {
    console.log(JSON.stringify(something));
  });
}

/** Returns the string content of the specified Handlebars file. The path is
 *  defined relative to the project folder. */
export function TemplFromFile(aPathName) {
  const oPathFull = join(new URL(".", import.meta.url).pathname, aPathName + ".hbs");
  // Templates are loaded when various modules are first required, so this can
  // and probably should be synchronous:
  return readFileSync(oPathFull, "utf8");
}
