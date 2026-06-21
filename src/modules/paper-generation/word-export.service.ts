import { prisma } from "@/lib/db";
import { TcetTemplateBuilder } from "@/modules/paper-generation/tcet-template-builder";
import type { PaperModel } from "@/modules/paper-generation/types";
import { TemplateConfig as C } from "@/modules/paper-generation/template-config";

const EXAM_TITLES: Record<string, string> = {
  "ISE-1": "IN-SEMESTER EXAMINATION – I",
  "ISE-2": "IN-SEMESTER EXAMINATION – II",
  ENDSEM: "END-SEMESTER EXAMINATION",
  KT: "KT EXAMINATION",
  SUPPLEMENTARY: "SUPPLEMENTARY EXAMINATION",
};

export class WordExportService {
  async export(
    questionBankId: string,
    variant: string,
    format: "docx" = "docx",
    watermarkLines?: string[],
  ): Promise<{ buffer: Buffer; filename: string; mime: string; paperId: string }> {
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

    if (!bank) throw new Error("Question bank not found");
    const paper = bank.generatedPapers[0];
    if (!paper) throw new Error("Generated paper not found");

    // Infer exam type from module numbers
    const modules = new Set(paper.items.map((i) => i.question.moduleNumber));
    const maxMod = Math.max(...modules);
    const minMod = Math.min(...modules);
    let examTypeKey: string;
    if (maxMod <= 3) examTypeKey = "ISE-1";
    else if (minMod >= 4) examTypeKey = "ISE-2";
    else examTypeKey = "ENDSEM";

    const totalMarks = paper.items.reduce((s, i) => s + i.question.marks, 0);

    // Group items by marks
    const marksMap = new Map<number, typeof paper.items>();
    for (const item of paper.items) {
      const m = item.question.marks;
      if (!marksMap.has(m)) marksMap.set(m, []);
      marksMap.get(m)!.push(item);
    }

    const isEndsem = examTypeKey === "ENDSEM";
    const marksGroups = isEndsem
      ? [
          { marks: 2, label: "Section A" },
          { marks: 5, label: "Section B" },
          { marks: 10, label: "Section C" },
        ]
      : [
          { marks: 2, label: "Section A" },
          { marks: 5, label: "Section B" },
        ];

    // Build sections — questions sorted by moduleNumber, labeled Q.1, Q.2, ...
    let qNum = 1;
    const sections = marksGroups.map(({ marks, label }) => {
      const items = (marksMap.get(marks) ?? []).sort(
        (a, b) => a.question.moduleNumber - b.question.moduleNumber,
      );
      const questions = items.map((item) => ({
        label: `Q.${qNum++}`,
        questionText: item.question.questionText,
        marks: item.question.marks,
        courseOutcome: item.question.coMapping,
        learningLevel: item.question.rbtLevel,
        orQuestionText: undefined,
      }));
      return { label, marks, questions };
    });

    // Derive questionGroups from sections for backward compat
    const questionGroups = sections.map((s, idx) => ({
      number: idx + 1,
      instruction: s.label,
      subQuestions: s.questions,
    }));

    const paperModel: PaperModel = {
      examTitle: EXAM_TITLES[examTypeKey] ?? "END-SEMESTER EXAMINATION",
      examType: examTypeKey as PaperModel["examType"],
      semester: `Semester ${bank.batchSemester.semesterNumber}`,
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
      sections,
      questionGroups,
    };

    const builder = new TcetTemplateBuilder();
    const buf = await builder.build(paperModel, watermarkLines);

    return {
      buffer: Buffer.from(buf),
      filename: `${bank.subject.subjectCode}-${variant}.docx`,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      paperId: paper.id,
    };
  }
}
