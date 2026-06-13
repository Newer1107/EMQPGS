import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

type PaperQuestion = {
  moduleNumber: number;
  marks: number;
  questionText: string;
  coMapping: string;
  rbtLevel: string;
};

type SelectedPaper = {
  label: string;
  subjectName: string;
  subjectCode: string;
  examType: string;
  examDate: string;
  duration: string;
  maximumMarks: number;
  institutionName: string;
  instructions: string[];
  questions: PaperQuestion[];
};

export class DocumentService {
  async createCombinedPdf(papers: SelectedPaper[]) {
    const pdf = await PDFDocument.create();
    const serif = await pdf.embedFont(StandardFonts.TimesRoman);
    const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const mono = await pdf.embedFont(StandardFonts.Courier);

    const PAGE_WIDTH = 842;
    const PAGE_HEIGHT = 1191;
    const MARGIN_X = 48;
    const CONTENT_START_Y = PAGE_HEIGHT - 72;
    const MARGIN_BOTTOM = 90;
    const CONTENT_WIDTH = 720;

    for (const paper of papers) {
      let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let y = CONTENT_START_Y;

      const ensureSpace = (needed: number) => {
        if (y - needed < MARGIN_BOTTOM) {
          page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          y = CONTENT_START_Y;
        }
      };

      ensureSpace(24);
      page.drawText(paper.institutionName, { x: MARGIN_X, y, size: 16, font: bold });
      y -= 24;

      ensureSpace(26);
      page.drawText(paper.label, { x: MARGIN_X, y, size: 26, font: bold });
      y -= 24;

      ensureSpace(16);
      page.drawText(`${paper.subjectName} (${paper.subjectCode})`, { x: MARGIN_X, y, size: 14, font: serif });
      y -= 16;

      ensureSpace(14);
      page.drawText(
        `${paper.examType} • ${paper.examDate} • ${paper.duration} • ${paper.maximumMarks} Marks`,
        { x: MARGIN_X, y, size: 12, font: mono },
      );
      y -= 24;

      ensureSpace(18);
      page.drawText("Instructions", { x: MARGIN_X, y, size: 14, font: bold });
      y -= 18;

      for (const instruction of paper.instructions) {
        ensureSpace(16);
        page.drawText(`• ${instruction}`, {
          x: MARGIN_X + 8,
          y,
          size: 11,
          font: serif,
          maxWidth: CONTENT_WIDTH,
          lineHeight: 14,
        });
        y -= 16;
      }
      y -= 10;

      for (const [index, question] of paper.questions.entries()) {
        ensureSpace(48);
        page.drawText(
          `${index + 1}. [M${question.moduleNumber} • ${question.marks}M • ${question.coMapping} • ${question.rbtLevel}]`,
          { x: MARGIN_X, y, size: 10, font: mono },
        );
        y -= 14;

        ensureSpace(34);
        page.drawText(question.questionText, {
          x: MARGIN_X + 8,
          y,
          size: 12,
          font: serif,
          maxWidth: CONTENT_WIDTH,
          lineHeight: 16,
        });
        y -= 34;
      }
    }

    return pdf.save();
  }

  async createCombinedDocx(papers: SelectedPaper[]) {
    const doc = new Document({
      sections: papers.map((paper) => ({
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: paper.institutionName, bold: true })],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: paper.label, bold: true })],
          }),
          new Paragraph(`${paper.subjectName} (${paper.subjectCode})`),
          new Paragraph(`${paper.examType} | ${paper.examDate} | ${paper.duration} | ${paper.maximumMarks} Marks`),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Instructions" }),
          ...paper.instructions.map((instruction) => new Paragraph({ text: instruction, bullet: { level: 0 } })),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Questions" }),
          ...paper.questions.flatMap((question, index) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. [M${question.moduleNumber} | ${question.marks}M | ${question.coMapping} | ${question.rbtLevel}]`,
                  bold: true,
                }),
              ],
            }),
            new Paragraph(question.questionText),
          ]),
        ],
      })),
    });

    return Packer.toBuffer(doc);
  }

  async createZipBundle(files: Array<{ fileName: string; content: Buffer | Uint8Array | string }>) {
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.fileName, file.content));
    return zip.generateAsync({ type: "nodebuffer" });
  }
}
