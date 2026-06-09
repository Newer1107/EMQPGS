import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AiQuestionBankReport } from "@/modules/ai/types";

export class PdfService {
  async createAiReportPdf(input: {
    title: string;
    subtitle: string;
    report: AiQuestionBankReport;
  }) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([842, 1191]);
    const serif = await pdf.embedFont(StandardFonts.TimesRoman);
    const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const mono = await pdf.embedFont(StandardFonts.Courier);

    let y = 1110;

    page.drawText(input.title, { x: 48, y, size: 28, font: bold, color: rgb(0, 0, 0) });
    y -= 28;
    page.drawText(input.subtitle, { x: 48, y, size: 12, font: mono, color: rgb(0.25, 0.25, 0.25) });
    y -= 26;
    page.drawLine({ start: { x: 48, y }, end: { x: 794, y }, thickness: 4, color: rgb(0, 0, 0) });
    y -= 30;

    const sections: Array<[string, string[]]> = [
      ["Executive Summary", [input.report.executiveSummary]],
      ["Missing Areas", input.report.missingAreas],
      ["Quality Findings", input.report.qualityFindings],
      ["Bloom's Balance", [input.report.bloomsBalance]],
    ];

    for (const [heading, lines] of sections) {
      page.drawText(heading, { x: 48, y, size: 18, font: bold, color: rgb(0, 0, 0) });
      y -= 22;
      for (const line of lines) {
        page.drawText(`• ${line}`, { x: 56, y, size: 12, font: serif, color: rgb(0, 0, 0), maxWidth: 720, lineHeight: 16 });
        y -= 18;
      }
      y -= 10;
    }

    page.drawText("Coverage Summary", { x: 48, y, size: 18, font: bold });
    y -= 24;
    for (const metric of input.report.moduleCoverage) {
      page.drawText(`${metric.label}: ${metric.approved}/${metric.total} approved`, {
        x: 56,
        y,
        size: 12,
        font: serif,
      });
      y -= 16;
    }

    return pdf.save();
  }

  async createPaperPdf(input: {
    title: string;
    subtitle: string;
    questions: Array<{ moduleNumber: number; marks: number; questionText: string; coMapping: string; rbtLevel: string }>;
  }) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([842, 1191]);
    const serif = await pdf.embedFont(StandardFonts.TimesRoman);
    const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const mono = await pdf.embedFont(StandardFonts.Courier);

    let y = 1110;
    page.drawText(input.title, { x: 48, y, size: 26, font: bold });
    y -= 24;
    page.drawText(input.subtitle, { x: 48, y, size: 12, font: mono });
    y -= 24;
    page.drawLine({ start: { x: 48, y }, end: { x: 794, y }, thickness: 4, color: rgb(0, 0, 0) });
    y -= 24;

    input.questions.forEach((question, index) => {
      page.drawText(`${index + 1}. [M${question.moduleNumber} • ${question.marks}M • ${question.coMapping} • ${question.rbtLevel}]`, {
        x: 48,
        y,
        size: 10,
        font: mono,
      });
      y -= 14;
      page.drawText(question.questionText, {
        x: 56,
        y,
        size: 12,
        font: serif,
        maxWidth: 720,
        lineHeight: 16,
      });
      y -= 34;
    });

    return pdf.save();
  }
}
