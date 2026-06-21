import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, VerticalAlign,
  convertInchesToTwip, convertMillimetersToTwip,
} from "docx";
import type { IPropertiesOptions } from "docx";
import type { PaperModel } from "@/modules/paper-generation/types";
import { loadHeader } from "@/modules/paper-generation/header-utils";

/* ─── Typography ─────────────────────────────────── */

const FONT = "Times New Roman";

const SIZE = {
  examTitle: 16,
  subjectLine: 13,
  metadata: 10,
  instruction: 10,
  questionLabel: 11,
  questionText: 11,
  marks: 10,
  co: 10,
  bloom: 10,
  orText: 11,
  sectionHeading: 12,
};

/* ─── Page ───────────────────────────────────────── */

const MARGINS = {
  top: convertInchesToTwip(0.8),
  bottom: convertInchesToTwip(0.8),
  left: convertInchesToTwip(1),
  right: convertInchesToTwip(1),
};

const PAGE_W = convertMillimetersToTwip(210);
const USABLE_W = PAGE_W - MARGINS.left - MARGINS.right;

/* ─── Column helpers ─────────────────────────────── */

const C = {
  qno: 700,
  marks: 650,
  co: 750,
  bloom: 750,
};

function qW(): number {
  return USABLE_W - C.qno - C.marks - C.co - C.bloom;
}

/* ─── Table cell factory ─────────────────────────── */

function cell(
  children: Paragraph[],
  opts: { width?: number; span?: number; align?: "center" | "top" } = {},
): TableCell {
  const props: Record<string, unknown> = {};
  if (opts.width) props.width = { size: opts.width, type: WidthType.DXA };
  if (opts.span) props.columnSpan = opts.span;
  if (opts.align === "center") props.verticalAlign = VerticalAlign.CENTER;
  return new TableCell({ children, ...props });
}

/* ─── Paragraph factory ──────────────────────────── */

function para(
  text: string,
  opts: { size?: number; bold?: boolean; align?: typeof AlignmentType.CENTER; spacing?: number } = {},
): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: (opts.size ?? 11) * 2, bold: opts.bold ?? false })],
    alignment: opts.align,
    spacing: opts.spacing ? { after: opts.spacing } : { after: 40 },
  });
}

/* ─── Border style used everywhere ───────────────── */

const THIN = { style: BorderStyle.SINGLE, size: 1 } as const;
const ALL_BORDERS = {
  top: THIN, bottom: THIN, left: THIN, right: THIN,
  insideHorizontal: THIN, insideVertical: THIN,
};

/* ─── Main builder ───────────────────────────────── */

export class WordTemplateBuilder {
  async build(model: PaperModel): Promise<Uint8Array> {
    const all: (Paragraph | Table)[] = [];

    /* ── 1. Header image ─────────────────────── */
    this.pushHeader(all);

    /* ── 2. Examination title ────────────────── */
    all.push(para(model.examTitle, { size: SIZE.examTitle, bold: true, align: AlignmentType.CENTER, spacing: 160 }));
    all.push(para(model.semester, { size: SIZE.subjectLine, align: AlignmentType.CENTER, spacing: 120 }));

    /* ── 3. Subject line ─────────────────────── */
    all.push(para(`SUBJECT – ${model.subjectName}`, { size: SIZE.subjectLine, bold: true, align: AlignmentType.CENTER, spacing: 160 }));

    /* ── 4. Metadata block (two-column table) ── */
    all.push(this.buildMetadataTable(model));

    /* ── 5. Instructions ─────────────────────── */
    all.push(para("Instructions:", { size: SIZE.instruction + 1, bold: true, spacing: 120 }));
    for (let i = 0; i < model.instructions.length; i++) {
      all.push(
        para(`${i + 1}. ${model.instructions[i]}`, {
          size: SIZE.instruction,
          spacing: 60,
        }),
      );
    }

    all.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

    /* ── 6. Question table ───────────────────── */
    all.push(this.buildQuestionTable(model));

    const opts: IPropertiesOptions = {
      sections: [{
        properties: { page: { margin: MARGINS } },
        children: all,
      }],
      styles: {
        default: { document: { run: { font: FONT, size: SIZE.questionText * 2 } } },
      },
    };

    return Packer.toBuffer(new Document(opts)).then((b) => new Uint8Array(b));
  }

  /* ── Header ─────────────────────────────────────── */

  private pushHeader(all: (Paragraph | Table)[]) {
    const header = loadHeader();
    if (!header) { all.push(new Paragraph({ spacing: { after: 200 }, children: [] })); return; }
    try {
      const imgW = USABLE_W - convertInchesToTwip(0.3);
      const ratio = 960 / 137;
      all.push(
        new Paragraph({
          children: [new ImageRun({ type: header.docxType, data: header.buffer, transformation: { width: imgW, height: Math.round(imgW / ratio) } })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      );
    } catch {
      all.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    }
  }

  /* ── Metadata two-column table ──────────────────── */

  private buildMetadataTable(model: PaperModel): Table {
    const cellOpt = (text: string, bold = false) =>
      new Paragraph({
        children: [new TextRun({ text, font: FONT, size: SIZE.metadata * 2, bold })],
        spacing: { after: 20 },
      });

    const left = [
      cellOpt(`Branch : ${model.branch}`, true),
      cellOpt(`Div : ${model.division}`),
      cellOpt(`Duration : ${model.duration}`),
    ];
    const right = [
      cellOpt(`Date : ${model.date}`, true),
      cellOpt(`Timing : ${model.timing}`),
      cellOpt(`Maximum Marks : ${model.maximumMarks}`),
    ];

    const half = (USABLE_W - 40) / 2;

    return new Table({
      rows: [
        new TableRow({
          children: [
            cell(left, { width: half }),
            cell(right, { width: half }),
          ],
        }),
      ],
      width: { size: USABLE_W, type: WidthType.DXA },
    });
  }

  /* ── Question table ─────────────────────────────── */

  private buildQuestionTable(model: PaperModel): Table {
    const rows: TableRow[] = [];

    /* Header row */
    rows.push(this.headerRow());

    for (const g of model.questionGroups) {
      /* Main question label row */
      rows.push(this.groupHeaderRow(g));

      for (const sq of g.subQuestions) {
        /* Sub-question row */
        rows.push(this.subQuestionRow(sq));

        /* Optional OR row */
        if (sq.orQuestionText) {
          rows.push(this.orRow());
          rows.push(this.subQuestionRow({ ...sq, label: "", questionText: sq.orQuestionText, orQuestionText: undefined }));
        }
      }
    }

    return new Table({
      rows,
      width: { size: USABLE_W, type: WidthType.DXA },
      borders: ALL_BORDERS,
    });
  }

  private headerRow(): TableRow {
    return new TableRow({
      tableHeader: true,
      children: [
        this.hCell("Q.No.", C.qno),
        this.hCell("Question", qW()),
        this.hCell("Marks", C.marks),
        this.hCell("Course Outcomes", C.co),
        this.hCell("Learning Levels", C.bloom),
      ],
    });
  }

  private hCell(text: string, w: number): TableCell {
    return cell([para(text, { size: SIZE.marks, bold: true, align: AlignmentType.CENTER })], { width: w, align: "center" });
  }

  /* Row for Q.N / instruction */
  private groupHeaderRow(g: import("@/modules/paper-generation/types").QuestionGroup): TableRow {
    return new TableRow({
      children: [
        cell([para(`Q.${g.number}`, { size: SIZE.questionLabel, bold: true })], { width: C.qno, align: "top" }),
        cell([para(g.instruction, { size: SIZE.questionText, bold: true })], { width: qW() }),
        cell([], { width: C.marks }),
        cell([], { width: C.co }),
        cell([], { width: C.bloom }),
      ],
    });
  }

  /* Row for a, b, c … */
  private subQuestionRow(sq: import("@/modules/paper-generation/types").SubQuestion): TableRow {
    return new TableRow({
      children: [
        cell([para(sq.label, { size: SIZE.questionLabel, bold: true })], { width: C.qno, align: "top" }),
        cell([para(sq.questionText, { size: SIZE.questionText })], { width: qW() }),
        cell([para(String(sq.marks), { size: SIZE.marks, align: AlignmentType.CENTER })], { width: C.marks, align: "center" }),
        cell([para(sq.courseOutcome, { size: SIZE.co, align: AlignmentType.CENTER })], { width: C.co, align: "center" }),
        cell([para(sq.learningLevel, { size: SIZE.bloom, align: AlignmentType.CENTER })], { width: C.bloom, align: "center" }),
      ],
    });
  }

  /* OR divider row */
  private orRow(): TableRow {
    return new TableRow({
      children: [
        cell([para("OR", { size: SIZE.orText, bold: true, align: AlignmentType.CENTER })], {
          width: USABLE_W,
          span: 5,
          align: "center",
        }),
      ],
    });
  }
}
