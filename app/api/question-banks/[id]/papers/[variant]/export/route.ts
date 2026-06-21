import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-handler";
import { WordTemplateBuilder } from "@/modules/paper-generation/word-template-builder";
import { PdfExporter } from "@/modules/paper-generation/pdf-exporter";
import type { PaperModel } from "@/modules/paper-generation/types";

const LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

const SUBJECT_PREFIXES: Record<string, string> = {
  BSC: "B. Sc.",
  BTECH: "B. Tech.",
  FE: "F.E./F.T.",
  SE: "S.E./S.T.",
  TE: "T.E./T.T.",
  BE: "B.E./B.T.",
};

const EXAM_TITLE: Record<string, string> = {
  "ISE-1": "IN-SEMESTER EXAMINATION – I",
  "ISE-2": "IN-SEMESTER EXAMINATION – II",
  ENDSEM: "END-SEMESTER EXAMINATION",
  KT: "KT EXAMINATION",
  SUPPLEMENTARY: "SUPPLEMENTARY EXAMINATION",
};

export const GET = withApiHandler(
  async (request) => {
    const segments = request.nextUrl.pathname.split("/");
    const variantIdx = segments.indexOf("papers") + 1;
    const variant = segments[variantIdx];
    const questionBankId = segments[segments.length - 3];
    const format = request.nextUrl.searchParams.get("format") ?? "docx";

    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: true,
        batchSemester: { include: { academicYear: true, batch: true, department: true } },
        generatedPapers: {
          where: { variant: variant as any },
          include: {
            items: {
              include: { question: true },
              orderBy: [{ question: { moduleNumber: "asc" } }, { question: { marks: "asc" } }],
            },
          },
        },
      },
    });

    if (!bank) {
      return NextResponse.json({ success: false, error: { message: "Question bank not found" } }, { status: 404 });
    }

    const paper = bank.generatedPapers[0];
    if (!paper) {
      return NextResponse.json({ success: false, error: { message: "Generated paper not found" } }, { status: 404 });
    }

    const moduleMap = new Map<number, typeof paper.items>();
    for (const item of paper.items) {
      const mod = item.question.moduleNumber;
      if (!moduleMap.has(mod)) moduleMap.set(mod, []);
      moduleMap.get(mod)!.push(item);
    }

    const groups = Array.from(moduleMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([moduleNumber, items], idx) => ({
        number: idx + 1,
        instruction: `Answer the following questions (Module ${moduleNumber})`,
        subQuestions: items.map((item, sqIdx) => ({
          label: LABELS[sqIdx] ?? String(sqIdx + 1),
          questionText: item.question.questionText,
          marks: item.question.marks,
          courseOutcome: item.question.coMapping,
          learningLevel: item.question.rbtLevel,
        })),
      }));

    const totalMarks = paper.items.reduce((s, i) => s + i.question.marks, 0);
    const semDisplay = SUBJECT_PREFIXES["FE"] ?? "";
    const semText = semDisplay
      ? `${semDisplay} (Semester-${bank.batchSemester.semesterNumber})`
      : `Semester ${bank.batchSemester.semesterNumber}`;

    const paperModel: PaperModel = {
      examTitle: EXAM_TITLE["ENDSEM"] ?? "END-SEMESTER EXAMINATION",
      examType: "ENDSEM",
      semester: semText,
      subjectCode: bank.subject.subjectCode,
      subjectName: bank.subject.subjectName,
      branch: bank.batchSemester.department?.name ?? bank.batchSemester.batch?.name ?? "",
      division: "ALL",
      duration: "3 Hours",
      timing: "12:00 PM to 1:00 PM",
      date: new Date().toLocaleDateString("en-IN", { year: "numeric", month: "2-digit", day: "2-digit" }),
      maximumMarks: totalMarks,
      instructions: [
        "All questions are compulsory.",
        "Assume suitable data wherever necessary.",
        "Diagrams/sketches should be drawn wherever necessary.",
        "Use of logarithmic table and drawing instruments is permitted.",
        "Figures to the right indicate full marks.",
      ],
      questionGroups: groups,
    };

    if (format === "pdf") {
      const exporter = new PdfExporter();
      const pdfBytes = await exporter.export(paperModel);
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${bank.subject.subjectCode}-${variant}.pdf"`,
        },
      });
    }

    const builder = new WordTemplateBuilder();
    const docxBytes = await builder.build(paperModel);
    return new NextResponse(Buffer.from(docxBytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${bank.subject.subjectCode}-${variant}.docx"`,
      },
    });
  },
  { responsibility: ["COORDINATOR" as const, "DEAN" as const] },
);
