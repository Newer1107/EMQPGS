import { QuestionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PaperGenerator } from "@/modules/reports/paper-generator";

function makeQuestion(id: string, moduleNumber: number, marks: 2 | 5 | 10) {
  return {
    id,
    moduleNumber,
    marks,
    status: QuestionStatus.APPROVED,
    usageCount: 0,
    lastUsedExam: null,
    lastUsedYear: null,
    lastUsedSemester: null,
    lastUsedType: null,
    difficultyLevel: "MEDIUM",
  };
}

describe("PaperGenerator", () => {
  it("creates balanced papers without duplicates across variants", () => {
    const generator = new PaperGenerator();
    const questions = [];
    let counter = 1;
    for (let variantDepth = 0; variantDepth < 3; variantDepth += 1) {
      for (let moduleNumber = 1; moduleNumber <= 6; moduleNumber += 1) {
        for (const marks of [2, 5, 10] as const) {
          questions.push(makeQuestion(`q-${counter++}`, moduleNumber, marks));
        }
      }
    }

    const generated = generator.generate(
      {
        subject: { subjectCode: "CS501" },
        examCycle: { academicYear: "2026-2027", semester: 5, examType: "ENDSEM" },
        questions,
        generatedPapers: [],
      } as never,
      ["PAPER_A", "PAPER_B", "PAPER_C"],
    );

    expect(generated).toHaveLength(3);
    expect(generated[0].selectedQuestions).toHaveLength(18);
    const unique = new Set(generated.flatMap((paper) => paper.selectedQuestions.map((question) => question.id)));
    expect(unique.size).toBe(54);
  });
});
