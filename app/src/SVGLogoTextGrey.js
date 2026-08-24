import { CoopParams } from "./Site.js";
import gSVGPDFKit from "svg-to-pdfkit";

/** Matches the original hardcoded invoice logo height (22.031927pt). */
export const InvoiceLogoHeight = 22;

/** Original logo aspect used when the SVG has no viewBox/width/height. */
const fallbackAspect = 74.1 / 22;

const fallbackEmptySVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>`;

export let InvoiceLogoSvg = fallbackEmptySVG;
export let InvoiceLogoWidth = InvoiceLogoHeight * fallbackAspect;

function svgAspectRatio(svg) {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const viewBox = root.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBox) {
    const parts = viewBox[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return parts[2] / parts[3];
    }
  }
  const width = root.match(/\bwidth\s*=\s*["']([\d.]+)/i);
  const height = root.match(/\bheight\s*=\s*["']([\d.]+)/i);
  if (width && height && parseFloat(height[1]) > 0) {
    return parseFloat(width[1]) / parseFloat(height[1]);
  }
  return fallbackAspect;
}

function applyInvoiceLogoSvg(svg) {
  InvoiceLogoSvg = svg;
  InvoiceLogoWidth = InvoiceLogoHeight * svgAspectRatio(svg);
}

/** Rec. 709 luminance; svg-to-pdfkit colorCallback receives [[r,g,b], opacity]. */
function grayscaleColor(color) {
  if (!color) return color;
  const [r, g, b] = color[0];
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [[gray, gray, gray], color[1]];
}

export function drawInvoiceLogo(doc, boundRight, y) {
  const height = InvoiceLogoHeight;
  const width = InvoiceLogoWidth;
  gSVGPDFKit(doc, InvoiceLogoSvg, boundRight - width, y, {
    width,
    height,
    assumePt: true,
    preserveAspectRatio: "xMaxYMin meet",
    colorCallback: grayscaleColor,
  });
}

export async function wLoadInvoiceLogo() {
  const source = CoopParams.InvoiceLogo;
  if (!source) {
    applyInvoiceLogoSvg(fallbackEmptySVG);
    return;
  }
  if (source.trimStart().startsWith("<")) {
    applyInvoiceLogoSvg(source);
    return;
  }
  try {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!/<svg[\s>]/i.test(text)) throw new Error("Response is not SVG");
    applyInvoiceLogoSvg(text);
  } catch (err) {
    console.error("Failed to load invoice logo SVG:", err);
    applyInvoiceLogoSvg(fallbackEmptySVG);
  }
}
