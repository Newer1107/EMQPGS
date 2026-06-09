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

    for (const paper of papers) {
      const page = pdf.addPage([842, 1191]);
      let y = 1120;
      page.drawText(paper.institutionName, { x: 48, y, size: 16, font: bold });
      y -= 24;
      page.drawText(paper.label, { x: 48, y, size: 26, font: bold });
      y -= 24;
      page.drawText(`${paper.subjectName} (${paper.subjectCode})`, { x: 48, y, size: 14, font: serif });
      y -= 16;
      page.drawText(`${paper.examType} • ${paper.examDate} • ${paper.duration} • ${paper.maximumMarks} Marks`, { x: 48, y, size: 12, font: mono });
      y -= 24;

      page.drawText("Instructions", { x: 48, y, size: 14, font: bold });
      y -= 18;
      for (const instruction of paper.instructions) {
        page.drawText(`• ${instruction}`, { x: 56, y, size: 11, font: serif, maxWidth: 720, lineHeight: 14 });
        y -= 16;
      }
      y -= 10;

      for (const [index, question] of paper.questions.entries()) {
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
        if (y < 90) {
          y = 1120;
        }
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
