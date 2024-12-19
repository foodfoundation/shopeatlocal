// AsstPDF.js
// ==========
// PDF Assistant
//
// This module extends PDFKit's functionality with additional text utilities
// and state management. The scope has expanded to provide consistent font,
// size, and color management across PDF generation.
//
// Implementation Notes:
// 1. Font State Management
//    - Current workaround: Custom state tracking for font properties
//    - Required for footer text rendering with different styles
//    - Properties tracked: font name, size, fill color
//
// 2. API Integration
//    - Use Set_NameFont, Set_SizeFont, and Set_ColorFill methods
//    - These wrap PDFKit's native font, fontSize, and fillColor methods
//    - Ensures consistent state management across the application
//
// Future Improvements:
// - Consider implementing a complete PDFKit wrapper
// - Add comprehensive documentation for each method
// - Standardize the API interface
//
// TODO: Add detailed documentation for each component

import _ from "lodash";
const { cloneDeep } = _;

class tAsst {
  constructor(aDoc, aOpts) {
    if (aOpts === undefined) aOpts = {};
    if (aOpts.MargTop === undefined) aOpts.MargTop = 36;
    if (aOpts.MargBtm === undefined) aOpts.MargBtm = 60;
    if (aOpts.MargLeft === undefined) aOpts.MargLeft = 36;
    if (aOpts.MargRight === undefined) aOpts.MargRight = aOpts.MargLeft;

    this.Doc = aDoc;

    this.MargTop = aOpts.MargTop;
    this.MargBtm = aOpts.MargBtm;
    this.MargLeft = aOpts.MargLeft;
    this.MargRight = aOpts.MargRight;

    /** The vertical distance between the bottom of the footer text and the
     *  bottom of the page. */
    this.MargFooter = 36;

    this.X = this.MargLeft;
    this.Y = this.MargTop;

    this.ScaleLine = 1.2;

    /** The current text properties. */
    this.PropsText = {};
    /** Text properties recorded by the Save method. */
    this.PropsTextSave = {};
  }

  get BoundRight() {
    return this.Doc.page.width - this.MargRight;
  }

  get BoundBtm() {
    return this.Doc.page.height - this.MargBtm;
  }

  get WthContent() {
    return this.Doc.page.width - this.MargLeft - this.MargRight;
  }

  get HgtContent() {
    return this.Doc.page.height - this.MargTop - this.MargBtm;
  }

  Return() {
    this.X = this.MargLeft;
  }

  Next(aFrac) {
    if (aFrac === undefined) aFrac = 1;
    this.Y += this.Doc._fontSize * this.ScaleLine * aFrac;
  }

  Lead() {
    return this.Doc._fontSize * (this.ScaleLine - 1.0);
  }

  LeadTop() {
    return this.Lead() * 0.9;
  }

  LeadBtm() {
    return this.Lead() * 0.1;
  }

  HgtLine() {
    return this.Doc._fontSize * this.ScaleLine;
  }

  Text(aText, aX, aY, aOpts) {
    if (aOpts === undefined) aOpts = {};

    const oTop = aY + this.LeadTop();
    this.Doc.text(aText, aX, oTop, aOpts);

    return {
      Wth: this.Doc.widthOfString(aText),
      Hgt: this.Doc.heightOfString(aText),
    };
  }

  Write(aText, aOpts) {
    aText = aText.toString();
    if (aOpts === undefined) aOpts = {};

    const oOut = this.Text(aText, this.X, this.Y, aOpts);
    // If a text width was given, advance by that amount. Otherwise, go to end
    // of text:
    this.X += aOpts.width ? aOpts.width : oOut.Wth;

    return oOut;
  }

  WriteAt(aText, aX, aY, aOpts) {
    if (aY !== undefined) this.Y = aY;
    if (aX !== undefined) this.X = aX;

    return this.Write(aText, aOpts);
  }

  WriteLine(aText, aOpts) {
    aText = aText.toString();
    if (aOpts === undefined) aOpts = {};

    const oOut = this.Text(aText, this.X, this.Y, aOpts);
    // If a text height was given, advance by that amount. Otherwise, go to next
    // line:
    this.Y += aOpts.height ? aOpts.height : this.Doc._fontSize * this.ScaleLine;

    return oOut;
  }

  WriteLineAt(aText, aX, aY, aOpts) {
    if (aY !== undefined) this.Y = aY;
    if (aX !== undefined) this.X = aX;

    return this.WriteLine(aText, aOpts);
  }

  Rule(aMargTop, aMargBtm) {
    if (aMargTop === undefined) aMargTop = this.Doc._fontSize;
    if (aMargBtm === undefined) aMargBtm = aMargTop;

    this.Y += aMargTop;
    this.Doc.moveTo(this.X, this.Y).lineTo(this.BoundRight, this.Y).stroke();
    this.Y += aMargBtm;
  }

  CkAddPage(aHgt) {
    if (this.Y + aHgt <= this.BoundBtm) return false;

    this.Doc.addPage();
    this.Y = this.MargTop;
    return true;
  }

  Footer(aTextLeft, aTextMid, aTextRight) {
    this.Save();

    // What about ScaleLine?: [TO DO]
    this.Set_NameFont("Helvetica-Bold");
    this.Set_SizeFont(9);
    this.Set_ColorFill("#888");

    const oY = this.Doc.page.height - this.MargFooter - this.HgtLine();

    if (aTextLeft) this.Text(aTextLeft, this.MargLeft, oY);

    if (aTextMid) {
      const oOptsMid = {
        width: this.WthContent,
        align: "center",
        lineBreak: true,
      };
      this.Text(aTextMid, this.MargLeft, oY, oOptsMid);
    }

    if (aTextRight) {
      const oOptsRight = {
        width: this.WthContent,
        align: "right",
        lineBreak: true,
      };
      this.Text(aTextRight, this.MargLeft, oY, oOptsRight);
    }

    this.Restore();
  }

  Set_NameFont(aNameFont) {
    this.Doc.font(aNameFont);
    this.PropsText.NameFont = aNameFont;
  }

  Set_SizeFont(aSizeFont) {
    this.Doc.fontSize(aSizeFont);
    this.PropsText.SizeFont = aSizeFont;
  }

  Set_ColorFill(aColorFill) {
    this.Doc.fillColor(aColorFill);
    this.PropsText.ColorFill = aColorFill;
  }

  Save() {
    this.PropsTextSave = cloneDeep(this.PropsText);
  }

  Restore() {
    if (this.PropsTextSave.NameFont) this.Set_NameFont(this.PropsTextSave.NameFont);
    if (this.PropsTextSave.SizeFont) this.Set_SizeFont(this.PropsTextSave.SizeFont);
    if (this.PropsTextSave.ColorFill) this.Set_ColorFill(this.PropsTextSave.ColorFill);
  }
}

export default function (aDoc, aOpts) {
  return new tAsst(aDoc, aOpts);
}
