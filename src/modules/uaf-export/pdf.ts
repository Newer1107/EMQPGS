import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import { buildUafReport } from "./report-model";

/** Standard PDF fonts cannot encode all source scripts. Escape unsupported code points losslessly. */
function fontText(text: string, font: PDFFont): string {
  return Array.from(text.normalize("NFC")).map(char => {
    if (char === "\n" || char === "\r") return " ";
    try { font.encodeText(char); return char; }
    catch { return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`; }
  }).join("");
}
function wrap(text: string, width: number, font: PDFFont, size: number): string[] {
  const lines: string[] = [];
  let line = "";
  // Character fallback also handles unbroken identifiers and arbitrarily long question text.
  for (const word of fontText(text, font).split(/\s+/)) {
    if (line && font.widthOfTextAtSize(`${line} ${word}`, size) <= width) { line += ` ${word}`; continue; }
    if (line) { lines.push(line); line = ""; }
    for (const char of word) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ""; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function exportUafPdf(input: unknown): Promise<Uint8Array> {
  const report = buildUafReport(input);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`UAF v3.3 Report — Version ${report.versionNumber}`);
  // Landscape A4 gives the mandatory nine-column audit room without removing any columns.
  const width = 841.89, height = 595.28, margin = 32, bottom = 38, lineHeight = 11, size = 8;
  let page = doc.addPage([width, height]);
  let y = height - margin;
  const write = (text: string, x: number, top: number, fontSize = size, strong = false) => page.drawText(fontText(text, strong ? bold : font), { x, y: top - fontSize, size: fontSize, font: strong ? bold : font });
  const newPage = () => {
    page = doc.addPage([width, height]); y = height - margin;
    write(`UAF v3.3 · Version ${report.versionNumber} · Continued`, margin, y, 9, true); y -= 22;
  };
  const paragraph = (text: string, fontSize = 9, strong = false) => {
    for (const line of wrap(text, width - margin * 2, strong ? bold : font, fontSize)) {
      if (y - (fontSize + 5) < bottom) newPage();
      write(line, margin, y, fontSize, strong); y -= fontSize + 5;
    }
  };
  paragraph(`Universal Academic Framework v3.3 · Report version ${report.versionNumber}`, 17, true);
  paragraph(`Engine: ${report.engineVersion} · Evidence hash: ${report.evidenceHash}`);
  paragraph("Missing evidence: Unable to Verify. Confidence measures evidence completeness, separately from academic quality. Unsupported font characters use [U+codepoint] notation.");

  for (const section of report.sections) {
    if (y < bottom + 85) newPage();
    y -= 10;
    paragraph(`${section.number}. ${section.title}`, 13, true);
    paragraph(`Confidence: ${section.confidence}`);
    if (section.narrative) paragraph(section.narrative);
    for (const table of section.tables) {
      const weights = table.headers.map(h => h === "Question Text" ? 3 : /Evidence|Comment|Recommendation|Interpretation|Requirement|Risk|Remarks/.test(h) ? 2 : 1);
      const total = weights.reduce((a, b) => a + b, 0);
      const widths = weights.map(w => (width - margin * 2) * w / total);
      const headers = table.headers.map((h, i) => wrap(h, widths[i] - 8, bold, size));
      const headerHeight = Math.max(...headers.map(h => h.length)) * lineHeight + 8;
      const drawCells = (cells: string[][], offset: number, count: number, header = false) => {
        const h = count * lineHeight + 8;
        let x = margin;
        for (let i = 0; i < cells.length; i++) {
          page.drawRectangle({ x, y: y - h, width: widths[i], height: h, borderWidth: .4, borderColor: rgb(.7, .73, .76), ...(header ? { color: rgb(.91, .94, .97) } : {}) });
          for (let j = 0; j < count; j++) if (cells[i][offset + j]) write(cells[i][offset + j], x + 4, y - 4 - j * lineHeight, size, header);
          x += widths[i];
        }
        y -= h;
      };
      const tableHeading = (continued = false) => {
        paragraph(`${table.title}${continued ? " (continued)" : ""}`, 10, true);
        drawCells(headers, 0, Math.max(...headers.map(h => h.length)), true);
      };
      if (y < bottom + headerHeight + 65) newPage();
      tableHeading();
      for (const row of table.rows) {
        const cells = row.map((cell, i) => wrap(cell, widths[i] - 8, font, size));
        const lines = Math.max(...cells.map(c => c.length));
        let offset = 0;
        // Move ordinary rows intact; split rows taller than a page, repeating all headers.
        if (lines * lineHeight + 8 > y - bottom && lines * lineHeight + 8 <= height - margin - bottom - headerHeight - 70) {
          newPage(); tableHeading(true);
        }
        while (offset < lines) {
          let available = Math.floor((y - bottom - 8) / lineHeight);
          if (available < 1) { newPage(); tableHeading(true); available = Math.floor((y - bottom - 8) / lineHeight); }
          const count = Math.min(available, lines - offset);
          drawCells(cells, offset, count); offset += count;
        }
      }
      y -= 16;
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`UAF v3.3 | Version ${report.versionNumber} | Page ${i + 1} of ${pages.length}`, { x: margin, y: 18, font, size: 8 }));
  return doc.save();
}
