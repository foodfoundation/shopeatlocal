// CSV.js
// ------
// Adaptation of 'csv-express':
//
//   https://www.npmjs.com/package/csv-express
//   https://github.com/jczaplew/csv-express
//
// This version contains the following changes:
//
// 1) The 'csvHeaders' option in 'csv' now wraps column names in double quotes;
//
// 2) The file no longer produces ESLint warnings.
//
// ----------------------------------------------------------------------------
//
// The MIT License
//
// Copyright (c) 2012 Seiya Konno <nulltask@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// 'Software'), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

"use strict";

import { ServerResponse } from "http";
const res = ServerResponse.prototype;

import iconvLite from "iconv-lite";
const { encode } = iconvLite;

export const separator = ",";
export const preventCast = false;
export const ignoreNullOrUndefined = true;

/**
 * Stricter parseFloat to support hexadecimal strings from
 * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/parseFloat#A_stricter_parse_function
 * @param {Mixed} value
 */
function filterFloat(value) {
  if (/^(-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value)) {
    return Number(value);
  }
  return NaN;
}

/*
 * Escape CSV field
 *
 * @param {Mixed} field
 * @return {String}
 * @api private
 */

function escape(field) {
  if (ignoreNullOrUndefined && field == undefined) {
    return "";
  }
  if (preventCast) {
    return '="' + String(field).replace(/"/g, '""') + '"';
  }
  if (!isNaN(filterFloat(field)) && isFinite(field)) {
    return parseFloat(field);
  }
  return '"' + String(field).replace(/"/g, '""') + '"';
}

/*
 Send CSV response

 {data} - Array objects or arrays
 {csvHeaders} - If true uses the keys of the objects in {obj} to set a header row
 {headers} - Optional HTTP response headers
 {status} - Optional status code
*/

res.csv = function (data, csvHeaders, headers, status) {
  var body = "";
  var headerRow = [];
  var statusCodeSet = true;

  this.charset = this.charset || "utf-8";
  this.header("Content-Type", "text/csv");

  // Set custom headers
  if (headers && headers instanceof Object) {
    // Use res.header() instead of res.set() to maintain backward compatibility with Express 2
    // Change to res.set() in next major version so that iteration is not required
    Object.keys(headers).forEach(
      function (header) {
        this.header(header, headers[header]);
      }.bind(this),
    );
  }

  // Set response status code
  if (status && Number.isInteger(status)) {
    // res.status does not work in Express 2, so make sure the error would be trapped
    try {
      this.status(status);
    } catch (error) {
      statusCodeSet = false;
    }
  }

  // headerRow is used to ensure key order
  for (var prop in data[0]) {
    if (Object.prototype.hasOwnProperty.call(data[0], prop)) {
      headerRow.push(prop);
    }
  }

  // Append the header row to the response if requested
  if (csvHeaders) {
    // Bit of magic here, don't touch.
    body += '"' + headerRow.join(`"${separator}"`) + '"\r\n';
  }

  // Convert the data to a CSV-like structure
  for (var i = 0; i < data.length; i++) {
    if (!(data[i] instanceof Array)) {
      data[i] = headerRow.map(function (key) {
        if (Object.prototype.hasOwnProperty.call(data[i], key)) {
          return data[i][key];
        } else {
          return null;
        }
      });
    }

    body += data[i].map(escape).join(separator) + "\r\n";
  }

  if (this.charset !== "utf-8") {
    body = encode(body, this.charset);
  }

  if (!statusCodeSet) {
    return this.send(body, status);
  }

  return this.send(body);
};

export default {
  separator,
  preventCast,
  ignoreNullOrUndefined,
  filterFloat,
  escape,
  res,
};
