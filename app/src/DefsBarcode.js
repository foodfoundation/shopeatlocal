// DefsBarcode.js
// --------------
// Barcode Format Specifications

// Barcode Structure
// ----------------
// Standard barcode format:
// | Position | Length | Content        |
// |----------|--------|----------------|
// | 1        | 1      | Scan prefix   |
// | 2        | 1      | Label type    |
// | 3        | 1      | Label version |
//
// Note: Consider adding version text to labels for future format changes

/** Scanner input prefix character.
 *  Used to distinguish scanner input from keyboard input.
 *  Must be a single character for compatibility with Read_ScanLblIt.
 */
export const PrefixScan = "^";

/** Label type code length */
export const LenCdType = 1;

/** Version identifier length */
export const LenVer = 1;

// Item Label Format
// ----------------
// Extended format for item labels:
// | Position | Length | Content          |
// |----------|--------|------------------|
// | 1-3      | 3      | Standard header |
// | 4-10     | 7      | Variety ID      |
// | 11-14    | 4      | Weight value    |
// | 15-21    | 7      | Cart item ID    |

/** Item label type identifier.
 *  Must not exceed LenCdType length.
 */
export const CdTypeIt = "I";

/** Current item label version.
 *  Must not exceed LenVer length.
 */
export const VerIt = "0";

/** Variety identifier length */
export const LenIDVty = 7;

/** Integer digits in weight value */
export const LenWgtWhole = 2;

/** Decimal digits in weight value */
export const LenWgtFrac = 2;

/** Total length of weight field */
export const LenWgt = LenWgtWhole + LenWgtFrac;

/** Cart item identifier length */
export const LenIDItCart = 7;

/** Total item label length including prefix.
 *  Calculation: prefix(1) + type(1) + version(1) + variety(7) + weight(4) + cart(7) = 21
 */
export const LenScanIt = PrefixScan.length + LenCdType + LenVer + LenIDVty + LenWgt + LenIDItCart;
