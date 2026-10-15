import "server-only";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { formatTaka, toNumber } from "@/lib/money";
import type { Order, OrderItem } from "@/generated/prisma/client";
import type { StoreInfo } from "@/lib/store-settings";

/**
 * The receipt as a PDF — the same document as the printable page at /admin/orders/[id]/receipt, but
 * generated server-side so it can be attached to emails. Drawn with pdfkit (no headless browser), in
 * Noto Sans for Latin text and Noto Sans Bengali for Bangla: customers write their names and
 * addresses in either, and the Taka sign (৳) lives in the Bengali block. Both are embedded from
 * src/assets/fonts, so nothing depends on fonts being installed wherever this runs.
 */

export type ReceiptOrder = Order & { items: OrderItem[] };

const INK = "#0c0c0d";
const MUTED = "#6b6b70";
const FAINT = "#9a9aa0";
const LINE = "#d8d8dc";
const PAGE_MARGIN = 48;

type FontSet = { latin: Buffer; latinBold: Buffer; bn: Buffer; bnBold: Buffer };
let fontCache: FontSet | null = null;

function loadFonts(): FontSet {
  if (fontCache) return fontCache;
  const dir = path.join(process.cwd(), "src", "assets", "fonts");
  const read = (name: string) => fs.readFileSync(path.join(dir, name));
  fontCache = {
    latin: read("NotoSans-Regular.ttf"),
    latinBold: read("NotoSans-Bold.ttf"),
    bn: read("NotoSansBengali-Regular.ttf"),
    bnBold: read("NotoSansBengali-Bold.ttf"),
  };
  return fontCache;
}

const SHIPPING_ZONE_LABEL: Record<string, string> = { INSIDE_DHAKA: "Inside Dhaka", OUTSIDE_DHAKA: "Outside Dhaka" };
const PAYMENT_LABEL: Record<string, string> = {
  COD: "Cash on delivery",
  BKASH: "bKash",
  SSLCOMMERZ: "Card / mobile banking",
};

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

function issuedAt(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type Run = { text: string; bengali: boolean };

/**
 * Splits text into runs by script: Bengali-block characters (which include ৳) use the Bengali font,
 * everything else the Latin one. The zero-width joiners that glue Bengali conjuncts together stay with
 * the Bengali run, otherwise a word would be cut in two fonts and lose its shaping.
 */
function toRuns(text: string): Run[] {
  const runs: Run[] = [];
  let prevBengali: boolean = false;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const bengali: boolean = (code >= 0x0980 && code <= 0x09ff) || ((code === 0x200c || code === 0x200d) && prevBengali);
    const last = runs[runs.length - 1];
    if (last && last.bengali === bengali) last.text += ch;
    else runs.push({ text: ch, bengali });
    prevBengali = bengali;
  }
  return runs;
}

type Painter = ReturnType<typeof makePainter>;

function makePainter(doc: PDFKit.PDFDocument, fonts: FontSet) {
  const fontFor = (bengali: boolean, bold: boolean) =>
    bengali ? (bold ? fonts.bnBold : fonts.bn) : bold ? fonts.latinBold : fonts.latin;

  function width(text: string, size: number, bold = false): number {
    let w = 0;
    for (const run of toRuns(text)) {
      doc.font(fontFor(run.bengali, bold)).fontSize(size);
      w += doc.widthOfString(run.text);
    }
    return w;
  }

  /** Draws one line at (x, y) — left, right (x is the right edge) or centre (x is the centre). */
  function text(
    str: string,
    x: number,
    y: number,
    o: { size?: number; bold?: boolean; color?: string; align?: "left" | "right" | "center"; spacing?: number } = {},
  ) {
    const size = o.size ?? 10;
    const bold = o.bold ?? false;
    // letter-spacing adds a gap after every character, including the last — count it so right- and
    // centre-aligned labels line up on their true edge
    const total = width(str, size, bold) + (o.spacing ?? 0) * [...str].length;
    let cursor = o.align === "right" ? x - total : o.align === "center" ? x - total / 2 : x;
    doc.fillColor(o.color ?? INK);
    for (const run of toRuns(str)) {
      doc.font(fontFor(run.bengali, bold)).fontSize(size);
      doc.text(run.text, cursor, y, { lineBreak: false, characterSpacing: o.spacing ?? 0 });
      cursor += doc.widthOfString(run.text);
    }
  }

  /** Greedy word wrap using the mixed-script width, so Bangla and Latin both break cleanly. */
  function wrap(str: string, maxWidth: number, size: number, bold = false): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of str.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && width(candidate, size, bold) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  /** Draws wrapped text and returns the y below it. */
  function paragraph(str: string, x: number, y: number, maxWidth: number, o: { size?: number; bold?: boolean; color?: string; lead?: number } = {}) {
    const size = o.size ?? 10;
    const lead = o.lead ?? size * 1.45;
    for (const l of wrap(str, maxWidth, size, o.bold)) {
      text(l, x, y, { size, bold: o.bold, color: o.color });
      y += lead;
    }
    return y;
  }

  return { text, width, wrap, paragraph };
}

/** The IC monogram (the lime crayon "I" and pink "C"), drawn as vectors so it stays sharp. */
function drawMonogram(doc: PDFKit.PDFDocument, x: number, y: number, scale: number) {
  doc.save();
  doc.translate(x, y).scale(scale);
  doc.rect(16, 6, 15, 38).fill("#c3f53a");
  doc.polygon([16, 44], [23.5, 60], [31, 44]).fill("#c3f53a");
  doc.rect(16, 25, 15, 7).fill(INK);
  doc.path("M76 16 C53 8 41 24 41 33 C41 42 53 56 76 48").lineWidth(12).lineCap("round").stroke("#ff2d84");
  doc.path("M50 9 Q59 5 68 9").lineWidth(4).lineCap("round").stroke("#ffd23b");
  doc.circle(84, 33, 3.6).fill("#26a7e6");
  doc.restore();
}

/** Builds the receipt PDF for an order. Throws on failure — callers decide whether that matters. */
export function buildReceiptPdf(order: ReceiptOrder, store: StoreInfo): Promise<Buffer> {
  const fonts = loadFonts();
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    // The default font — keeps pdfkit from loading its built-in Helvetica. pdfkit accepts a Buffer here
    // (its typings only list a path), so the cast is only for the type checker.
    font: fonts.latin as unknown as string,
    info: {
      Title: `Receipt ${order.number}`,
      Author: store.name,
      Subject: `Order #${order.number}`,
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const p: Painter = makePainter(doc, fonts);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const contentWidth = right - left;
  const bottomLimit = doc.page.height - PAGE_MARGIN - 40;
  let y = PAGE_MARGIN;

  const rule = (at: number, color = LINE) => doc.moveTo(left, at).lineTo(right, at).lineWidth(0.7).strokeColor(color).stroke();

  // ---- header: brand on the left, store details on the right
  drawMonogram(doc, left, y - 2, 0.62);
  p.text("INVERTED", left + 66, y + 6, { size: 11, bold: true, spacing: 1.2 });
  p.text("CRAYON", left + 66, y + 20, { size: 11, bold: true, color: "#ff2d84", spacing: 1.2 });
  let sy = y;
  p.text(store.name, right, sy, { size: 10, bold: true, align: "right" });
  for (const line of [store.address, store.email, store.phone]) {
    sy += 13;
    p.text(line, right, sy, { size: 9, color: MUTED, align: "right" });
  }
  y = Math.max(y + 46, sy + 16);
  rule(y);

  // ---- title and order meta
  y += 18;
  p.text("RECEIPT", left, y, { size: 24, bold: true, spacing: 1 });
  p.text(`Order #${order.number}`, left, y + 30, { size: 10, color: MUTED });
  const metaRows: [string, string][] = [
    ["Issued", issuedAt(order.createdAt)],
    ["Order status", titleCase(order.status)],
    ["Payment", `${PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod} · ${titleCase(order.paymentStatus)}`],
  ];
  let my = y + 2;
  for (const [label, value] of metaRows) {
    const vw = p.width(value, 10, true);
    p.text(value, right, my, { size: 10, bold: true, align: "right" });
    p.text(label, right - vw - 8, my, { size: 9, color: FAINT, align: "right" });
    my += 15;
  }
  y = Math.max(y + 52, my + 6);

  // ---- billed to / ship to
  rule(y);
  y += 16;
  const colWidth = contentWidth / 2 - 14;
  const rightColX = left + contentWidth / 2 + 14;
  p.text("BILLED TO", left, y, { size: 8.5, bold: true, color: FAINT, spacing: 1.2 });
  p.text("SHIP TO", rightColX, y, { size: 8.5, bold: true, color: FAINT, spacing: 1.2 });
  let ly = y + 15;
  let ry = y + 15;
  ly = p.paragraph(order.shippingFullName, left, ly, colWidth, { size: 10, bold: true });
  ly = p.paragraph(order.email, left, ly, colWidth, { size: 9.5, color: MUTED });
  ly = p.paragraph(order.phone, left, ly, colWidth, { size: 9.5, color: MUTED });
  ry = p.paragraph(order.shippingFullName, rightColX, ry, colWidth, { size: 10, bold: true });
  ry = p.paragraph(`${order.shippingLine1}, ${order.shippingArea}`, rightColX, ry, colWidth, { size: 9.5, color: MUTED });
  ry = p.paragraph(
    `${order.shippingDistrict} ${order.shippingPostcode}, ${order.shippingCountry}`,
    rightColX,
    ry,
    colWidth,
    { size: 9.5, color: MUTED },
  );
  ry = p.paragraph(SHIPPING_ZONE_LABEL[order.shippingZone] ?? order.shippingZone, rightColX, ry, colWidth, { size: 9.5, color: MUTED });
  y = Math.max(ly, ry) + 6;
  rule(y);

  // ---- items table
  y += 18;
  const cols = {
    item: left,
    variant: left + contentWidth * 0.4,
    qty: left + contentWidth * 0.66,
    unit: left + contentWidth * 0.84,
    total: right,
  };
  const itemWidth = cols.variant - cols.item - 10;
  const variantWidth = cols.qty - cols.variant - 28;
  const drawTableHead = (at: number) => {
    p.text("ITEM", cols.item, at, { size: 8.5, bold: true, color: FAINT, spacing: 1 });
    p.text("VARIANT", cols.variant, at, { size: 8.5, bold: true, color: FAINT, spacing: 1 });
    p.text("QTY", cols.qty, at, { size: 8.5, bold: true, color: FAINT, spacing: 1, align: "right" });
    p.text("UNIT PRICE", cols.unit, at, { size: 8.5, bold: true, color: FAINT, spacing: 1, align: "right" });
    p.text("TOTAL", cols.total, at, { size: 8.5, bold: true, color: FAINT, spacing: 1, align: "right" });
    rule(at + 14, "#bdbdc2");
    return at + 24;
  };
  y = drawTableHead(y);

  for (const item of order.items) {
    const title = item.isPreorder ? `${item.productTitleSnapshot}  · preorder` : item.productTitleSnapshot;
    const titleLines = p.wrap(title, itemWidth, 10);
    const variantLines = p.wrap(item.variantLabelSnapshot, variantWidth, 9.5);
    const rowHeight = Math.max(titleLines.length, variantLines.length) * 14 + 8;
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = PAGE_MARGIN;
      y = drawTableHead(y);
    }
    titleLines.forEach((l, i) => p.text(l, cols.item, y + i * 14, { size: 10 }));
    variantLines.forEach((l, i) => p.text(l, cols.variant, y + i * 14, { size: 9.5, color: MUTED }));
    p.text(String(item.qty), cols.qty, y, { size: 10, align: "right" });
    p.text(formatTaka(toNumber(item.unitPrice)), cols.unit, y, { size: 10, align: "right" });
    p.text(formatTaka(toNumber(item.lineTotal)), cols.total, y, { size: 10, align: "right" });
    y += rowHeight;
    rule(y - 4, "#ececef");
  }

  // ---- totals
  const discount = toNumber(order.discountAmount);
  const totalsRows: [string, string, boolean][] = [["Subtotal", formatTaka(toNumber(order.subtotal)), false]];
  if (discount > 0 || order.discountCode) {
    totalsRows.push([
      `Coupon${order.discountCode ? ` · ${order.discountCode}` : ""}`,
      discount > 0 ? `-${formatTaka(discount)}` : "Free delivery",
      false,
    ]);
  }
  totalsRows.push(["Shipping", formatTaka(toNumber(order.shippingCost)), false]);
  const blockHeight = totalsRows.length * 17 + 34 + (order.isPreorder ? 34 : 0) + (order.trackingCourier ? 44 : 0) + 90;
  if (y + blockHeight > bottomLimit) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  y += 12;
  const tLeft = right - 230;
  for (const [label, value] of totalsRows) {
    p.text(label, tLeft, y, { size: 10, color: MUTED });
    p.text(value, right, y, { size: 10, align: "right" });
    y += 17;
  }
  doc.moveTo(tLeft, y + 1).lineTo(right, y + 1).lineWidth(0.9).strokeColor(INK).stroke();
  y += 9;
  p.text("TOTAL", tLeft, y, { size: 13, bold: true, spacing: 0.8 });
  p.text(formatTaka(toNumber(order.total)), right, y - 1, { size: 15, bold: true, align: "right" });
  y += 26;
  if (order.isPreorder) {
    doc.moveTo(tLeft, y - 4).lineTo(right, y - 4).lineWidth(0.6).dash(2, { space: 2 }).strokeColor(LINE).stroke().undash();
    y = p.paragraph("Preorder Now and Our Sales Agent Will Reach Out.", tLeft, y + 2, 230, { size: 9.5, color: MUTED });
    y += 4;
  }

  if (order.trackingCourier) {
    y += 10;
    rule(y);
    p.text(`Shipped via ${order.trackingCourier} · ref ${order.trackingRef ?? "—"}`, left, y + 12, { size: 9.5, color: MUTED });
    y += 32;
  }

  // ---- footer
  y = Math.max(y + 24, doc.page.height - PAGE_MARGIN - 70);
  rule(y);
  p.text("Thanks for standing out.", left + contentWidth / 2, y + 16, { size: 14, bold: true, align: "center" });
  p.text(`Questions about this order? ${store.email} · ${store.phone}`, left + contentWidth / 2, y + 38, {
    size: 9,
    color: FAINT,
    align: "center",
  });

  doc.end();
  return finished;
}
