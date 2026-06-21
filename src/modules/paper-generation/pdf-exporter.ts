import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PaperModel } from "@/modules/paper-generation/types";
import { loadHeader } from "@/modules/paper-generation/header-utils";

const PW = 595.28;
const PH = 841.89;
const ML = 72;
const MR = 72;
const MT = 64;
const MB = 64;
const UW = PW - ML - MR;

export class PdfExporter {
  async export(model: PaperModel): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    let page = doc.addPage([PW, PH]);
    let y = PH - MT;
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

    function text(t: string, s = 11, f = font) { return { text: t, size: s, font: f, color: rgb(0, 0, 0) }; }
    function draw(x: number, _y: number, t: ReturnType<typeof text>, mw = UW) { page.drawText(t.text, { x, y: _y, size: t.size, font: t.font, color: t.color, maxWidth: mw }); }

    function centered(t: string, s = 11, b = false) {
      const f = b ? bold : font;
      const w = f.widthOfTextAtSize(t, s);
      draw((PW - w) / 2, y, text(t, s, f));
      y -= s * 1.7;
    }

    function body(t: string, s = 11, b = false) {
      draw(ML, y, text(t, s, b ? bold : font));
      y -= s * 1.4;
    }

    function line(x1: number, y1: number, x2: number, _y: number) {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: _y }, thickness: 0.5, color: rgb(0, 0, 0) });
    }

    function check() {
      if (y < MB + 60) {
        page = doc.addPage([PW, PH]);
        y = PH - MT;
      }
    }

    /* Header image */
    const header = loadHeader(process.cwd());
    if (header) {
      try {
        let img;
        try { img = await doc.embedPng(header.buffer); } catch { try { img = await doc.embedJpg(header.buffer); } catch { img = null; } }
        if (img) {
          const d = img.scaleToFit(UW, 180);
          page.drawImage(img, { x: (PW - d.width) / 2, y: y - d.height, width: d.width, height: d.height });
          y -= d.height + 16;
        }
      } catch { y -= 16; }
    }

    centered(model.examTitle, 15, true);
    centered(model.semester, 12);
    centered(`SUBJECT – ${model.subjectName}`, 12, true);
    y -= 8;

    /* Metadata */
    const ms = 10;
    const leftLines = [`Branch : ${model.branch}`, `Div : ${model.division}`, `Duration : ${model.duration}`];
    const rightLines = [`Date : ${model.date}`, `Timing : ${model.timing}`, `Maximum Marks : ${model.maximumMarks}`];
    const metaY = y;
    for (const l of leftLines) { draw(ML, y, text(l, ms, bold), UW / 2); y -= ms * 1.4; }
    y = metaY;
    for (const l of rightLines) { draw(ML + UW / 2, y, text(l, ms, bold), UW / 2); y -= ms * 1.4; }
    y -= 8;

    /* Instructions */
    body("Instructions:", 11, true);
    y -= 2;
    for (let i = 0; i < model.instructions.length; i++) {
      check();
      body(`${i + 1}. ${model.instructions[i]}`, 10);
      y -= 2;
    }
    y -= 8;

    /* Question table */
    const colX = { qno: ML, question: ML + 50, marks: ML + UW - 210, co: ML + UW - 100, bloom: ML + UW - 45 };

    check();
    line(ML, y, PW - MR, y); y -= 3;
    body("Q.No.", 10, true); draw(colX.question, y, text("Question", 10, bold));
    draw(colX.marks, y, text("Marks", 10, bold)); draw(colX.co, y, text("CO", 10, bold)); draw(colX.bloom, y, text("BL", 10, bold));
    line(ML, y, PW - MR, y); y -= 4;

    for (const g of model.questionGroups) {
      check();
      line(ML, y, PW - MR, y); y -= 2;
      draw(ML, y, text(`Q.${g.number}`, 11, bold));
      draw(ML + 50, y, text(g.instruction, 11, bold), colX.marks - ML - 60);
      y -= 1;
      line(ML, y, PW - MR, y); y -= 4;

      for (const sq of g.subQuestions) {
        check();
        draw(ML, y, text(sq.label, 10));
        const qText = sq.orQuestionText ? `${sq.questionText}  OR  ${sq.orQuestionText}` : sq.questionText;
        draw(ML + 50, y, text(qText, 10), colX.marks - ML - 60);
        draw(colX.marks, y, text(String(sq.marks), 10));
        draw(colX.co, y, text(sq.courseOutcome, 10));
        draw(colX.bloom, y, text(sq.learningLevel, 10));
        y -= 4;

        if (sq.orQuestionText) {
          line(ML, y, PW - MR, y); y -= 2;
          draw(ML + 50, y, text("OR", 11, bold), UW);
          y -= 2;
          line(ML, y, PW - MR, y); y -= 2;
          draw(ML + 50, y, text(sq.orQuestionText, 10), colX.marks - ML - 60);
          y -= 4;
        }
      }
      line(ML, y, PW - MR, y); y -= 6;
    }

    return doc.save();
  }
}
