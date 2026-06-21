import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType,
} from "docx";
import type { IPropertiesOptions } from "docx";
import { TemplateConfig as C } from "@/modules/paper-generation/template-config";
import { loadHeader } from "@/modules/paper-generation/header-utils";
import type { PaperModel } from "@/modules/paper-generation/types";

/* ─── Cell factory ───────────────────────────────── */

function cell(
  children: Paragraph[],
  opts: { width?: number; span?: number; align?: "center" | "top"; fill?: string } = {},
): TableCell {
  const props: Record<string, unknown> = {};
  if (opts.width) props.width = { size: opts.width, type: WidthType.DXA };
  if (opts.span) props.columnSpan = opts.span;
  if (opts.align === "center") props.verticalAlign = VerticalAlign.CENTER;
  if (opts.fill) props.shading = { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" };
  return new TableCell({ children, ...props });
}

/* ─── Paragraph factory ──────────────────────────── */

function para(
  text: string,
  opts: { size?: number; bold?: boolean; align?: typeof AlignmentType.CENTER; spacing?: number } = {},
): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: C.font, size: (opts.size ?? 11) * 2, bold: opts.bold ?? false })],
    alignment: opts.align,
    spacing: opts.spacing ? { after: opts.spacing } : { after: C.spacing.afterParagraph },
  });
}

/* ─── Border style ───────────────────────────────── */

const THIN = { style: BorderStyle.SINGLE, size: C.table.borderSize } as const;
const TABLE_BORDERS = {
  top: THIN, bottom: THIN, left: THIN, right: THIN,
  insideHorizontal: THIN, insideVertical: THIN,
};

/* ─── Exported builder ───────────────────────────── */

export class TcetTemplateBuilder {
  build(model: PaperModel): Promise<Uint8Array> {
    const all: (Paragraph | Table)[] = [];

    /* 1. Header image */
    this.pushHeader(all);

    /* 2. Title & subject */
    all.push(para(model.examTitle, { size: C.fontSize.examTitle, bold: true, align: AlignmentType.CENTER, spacing: C.spacing.afterTitle }));
    all.push(para(model.semester, { size: C.fontSize.subjectLine, align: AlignmentType.CENTER, spacing: C.spacing.afterSubject }));
    all.push(para(`SUBJECT – ${model.subjectName}`, { size: C.fontSize.subjectLine, bold: true, align: AlignmentType.CENTER, spacing: C.spacing.afterSubject }));

    /* 3. Metadata two-column table */
    all.push(this.buildMetadata(model));

    /* 4. Instructions */
    all.push(para("Instructions:", { size: C.fontSize.instruction + 1, bold: true, spacing: C.spacing.afterInstructionBlock }));
    for (let i = 0; i < model.instructions.length; i++) {
      all.push(para(`${i + 1}. ${model.instructions[i]}`, { size: C.fontSize.instruction, spacing: C.spacing.afterInstruction }));
    }

    /* spacer */
    all.push(new Paragraph({ spacing: { after: C.spacing.afterSection }, children: [] }));

    /* 5. Question table */
    all.push(this.buildQuestionTable(model));

    const opts: IPropertiesOptions = {
      sections: [{
        properties: { page: { margin: C.page.margins } },
        children: all,
      }],
      styles: {
        default: { document: { run: { font: C.font, size: C.fontSize.questionText * 2 } } },
      },
    };

    return Packer.toBuffer(new Document(opts)).then((b) => new Uint8Array(b));
  }

  /* ── Header image (page one only) ──────────────── */

  private pushHeader(all: (Paragraph | Table)[]) {
    const header = loadHeader();
    if (!header) { all.push(new Paragraph({ spacing: { after: C.spacing.afterSection }, children: [] })); return; }
    try {
      const pageWInches = 210 / 25.4;
      const marginInches = 0.8;
      const usableInches = pageWInches - marginInches * 2;
      const imgWInches = usableInches - 0.3;
      const imgWPx = Math.round(imgWInches * 96);
      const imgHPx = Math.round(imgWPx / C.header.aspectRatio);
      all.push(
        new Paragraph({
          children: [new ImageRun({ type: header.docxType, data: header.buffer, transformation: { width: imgWPx, height: imgHPx } })],
          alignment: AlignmentType.CENTER,
          spacing: { after: C.spacing.afterSection },
        }),
      );
    } catch {
      all.push(new Paragraph({ spacing: { after: C.spacing.afterSection }, children: [] }));
    }
  }

  /* ── Metadata table ────────────────────────────── */

  private buildMetadata(model: PaperModel): Table {
    const half = (C.usableWidth - 40) / 2;
    const mkPara = (text: string, bold = false) =>
      new Paragraph({ children: [new TextRun({ text, font: C.font, size: C.fontSize.metadata * 2, bold })], spacing: { after: 20 } });

    const left = [
      mkPara(`Branch : ${model.branch}`, true),
      mkPara(`Div : ${model.division}`),
      mkPara(`Duration : ${model.duration}`),
    ];
    const right = [
      mkPara(`Date : ${model.date}`, true),
      mkPara(`Timing : ${model.timing}`),
      mkPara(`Maximum Marks : ${model.maximumMarks}`),
    ];

    return new Table({
      rows: [new TableRow({ children: [cell(left, { width: half }), cell(right, { width: half })] })],
      width: { size: C.usableWidth, type: WidthType.DXA },
    });
  }

  /* ── Question table ────────────────────────────── */

  private buildQuestionTable(model: PaperModel): Table {
    const { qno, marks, co, bloom } = C.table.columnWidths;
    const qw = C.usableWidth - qno - marks - co - bloom;

    const rows: TableRow[] = [];

    /* Header row */
    rows.push(new TableRow({
      tableHeader: C.table.headerRow,
      children: [
        this.hCell("Q.No.", qno),
        this.hCell("Question", qw),
        this.hCell("Marks", marks),
        this.hCell("Course Outcomes", co),
        this.hCell("Learning Levels", bloom),
      ],
    }));

    for (const sec of model.sections) {
      /* Section header row (merged across all 5 columns with shading) */
      const sectionText = `${sec.label} — Answer ALL questions (${sec.marks} marks each)`;
      rows.push(new TableRow({
        children: [
          cell([para(sectionText, { size: C.fontSize.sectionHeading, bold: true, align: AlignmentType.CENTER })], {
            width: C.usableWidth, span: 5, align: "center", fill: "E8EDF5",
          }),
        ],
      }));

      for (const sq of sec.questions) {
        /* Question row */
        rows.push(new TableRow({
          children: [
            cell([para(sq.label, { size: C.fontSize.questionLabel, bold: true })], { width: qno, align: "top" }),
            cell([para(sq.questionText, { size: C.fontSize.questionText })], { width: qw }),
            cell([para(String(sq.marks), { size: C.fontSize.marks, align: AlignmentType.CENTER })], { width: marks, align: "center" }),
            cell([para(sq.courseOutcome, { size: C.fontSize.co, align: AlignmentType.CENTER })], { width: co, align: "center" }),
            cell([para(sq.learningLevel, { size: C.fontSize.bloom, align: AlignmentType.CENTER })], { width: bloom, align: "center" }),
          ],
        }));

        /* OR row */
        if (sq.orQuestionText) {
          rows.push(new TableRow({
            children: [cell([para("OR", { size: C.fontSize.orText, bold: true, align: AlignmentType.CENTER })], { width: C.usableWidth, span: 5, align: "center" })],
          }));
          rows.push(new TableRow({
            children: [
              cell([para("", { size: C.fontSize.questionLabel, bold: true })], { width: qno, align: "top" }),
              cell([para(sq.orQuestionText, { size: C.fontSize.questionText })], { width: qw }),
              cell([para(String(sq.marks), { size: C.fontSize.marks, align: AlignmentType.CENTER })], { width: marks, align: "center" }),
              cell([para(sq.courseOutcome, { size: C.fontSize.co, align: AlignmentType.CENTER })], { width: co, align: "center" }),
              cell([para(sq.learningLevel, { size: C.fontSize.bloom, align: AlignmentType.CENTER })], { width: bloom, align: "center" }),
            ],
          }));
        }
      }
    }

    return new Table({
      rows,
      width: { size: C.usableWidth, type: WidthType.DXA },
      borders: TABLE_BORDERS,
    });
  }

  private hCell(text: string, w: number): TableCell {
    return cell([para(text, { size: C.fontSize.marks, bold: true, align: AlignmentType.CENTER })], { width: w, align: "center" });
  }
}
