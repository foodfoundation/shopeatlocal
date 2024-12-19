// Barcode.js
// ==========
// Barcode utilities
//
// Scanner Configuration
// -------------------
// Implementation Details:
// 1. Scanner Output:
//    - HID scanners emit keyboard-like input
//    - Pages handle both scanner and keyboard input
//    - Caret ('^') prefix distinguishes scanner input
//
// 2. Prefix Selection:
//    - Caret chosen for broad browser compatibility
//    - Ensures consistent behavior across different browsers
//    - Provides reliable input source identification
//
// 3. Input Handling:
//    - Scanner input processed in "scan mode"
//    - Mode exits after expected character count
//    - Optional timeout can be added for additional validation
//    - Invalid input detection available
//
// Configuration Resources:
// - Reference documents in 'Extra/Scanners':
//   - BCST-51 Prefix and Suffix Appendix II.docx
//   - BCST-52 Manual.pdf
//
// Label Structure:
// - Labels include content-specific prefixes (e.g., 'I' for item labels)
// - Prefixes identify different label types
// - UPC/EAN codes maintain standard format with scanner prefix

import {
  LenWgt,
  LenWgtWhole,
  LenWgtFrac,
  LenIDVty,
  LenIDItCart,
  CdTypeIt,
  VerIt,
} from "./DefsBarcode.js";

/** Returns characters encoding item label data, to be embedded in a QR code.
 *  The scanner prefix is not included. */
export function DataIt(aIDVty, aWgt, aIDItCart) {
  function TextLblWgt(aWgt) {
    if (!aWgt) return "0".repeat(LenWgt);

    if (aWgt >= Math.pow(10.0, LenWgtWhole)) throw Error("Barcode TextLblWgt: Invalid weight");

    let oText = Number(aWgt).toFixed(LenWgtFrac).toString();
    const oIdxDot = oText.indexOf(".");
    if (oIdxDot < 0) {
      oText += "0".repeat(LenWgtFrac);
      return oText.padStart(LenWgt, "0");
    }

    const oTextWhole = oText.substr(0, oIdxDot).padStart(LenWgtWhole, "0");
    const oTextFrac = oText.substring(oIdxDot + 1).padEnd(LenWgtFrac, "0");
    return oTextWhole + oTextFrac;
  }

  const oTextVty = aIDVty.toString().padStart(LenIDVty, "0");
  const oTextWgt = TextLblWgt(aWgt);
  const oTextItCart = aIDItCart
    ? aIDItCart.toString().padStart(LenIDItCart, "0")
    : "0".repeat(LenIDItCart);
  return CdTypeIt + VerIt + oTextVty + oTextWgt + oTextItCart;
}
