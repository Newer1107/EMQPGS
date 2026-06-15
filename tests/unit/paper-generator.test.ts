import { QuestionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PaperGenerator } from "@/modules/reports/paper-generator";

function makeSlot(id: string, moduleNumber: number, marks: 2 | 5 | 10) {
  return {
    assignedQuestion: {
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
    },
  };
}

const modules = [1, 2, 3, 4, 5, 6];

describe("PaperGenerator", () => {
  it("creates balanced papers without duplicates across variants", () => {
    const generator = new PaperGenerator();
    const slots = [];
    let counter = 1;
    for (let variantDepth = 0; variantDepth < 3; variantDepth += 1) {
      for (const moduleNumber of modules) {
        for (const marks of [2, 5, 10] as const) {
          slots.push(makeSlot(`q-${counter++}`, moduleNumber, marks));
        }
      }
    }

    const generated = generator.generate(
      {
        subject: { subjectCode: "CS501" },
        examCycle: { academicYear: { code: "2026-2027" }, semester: { number: 5 }, examType: "ENDSEM" },
        slots,
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
