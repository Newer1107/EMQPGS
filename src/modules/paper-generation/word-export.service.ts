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
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
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

    const moduleMap = new Map<number, typeof paper.items>();
    for (const item of paper.items) {
      const mod = item.question.moduleNumber;
      if (!moduleMap.has(mod)) moduleMap.set(mod, []);
      moduleMap.get(mod)!.push(item);
    }

    const groups = Array.from(moduleMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([_moduleNumber, items], idx) => ({
        number: idx + 1,
        instruction: "Answer the following questions",
        subQuestions: items.map((item, sqIdx) => ({
          label: C.sectionLabels[sqIdx] ?? String(sqIdx + 1),
          questionText: item.question.questionText,
          marks: item.question.marks,
          courseOutcome: item.question.coMapping,
          learningLevel: item.question.rbtLevel,
        })),
      }));

    const totalMarks = paper.items.reduce((s, i) => s + i.question.marks, 0);

    const paperModel: PaperModel = {
      examTitle: EXAM_TITLES["ENDSEM"] ?? "END-SEMESTER EXAMINATION",
      examType: "ENDSEM",
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
      questionGroups: groups,
    };

    const builder = new TcetTemplateBuilder();
    const buf = await builder.build(paperModel);

    return {
      buffer: Buffer.from(buf),
      filename: `${bank.subject.subjectCode}-${variant}.docx`,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
}
