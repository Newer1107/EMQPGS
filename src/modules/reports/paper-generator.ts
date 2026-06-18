import { PaperVariant, QuestionStatus, type Prisma } from "@prisma/client";
import type { QuestionLibraryItem } from "@prisma/client";
import { AppError } from "@/lib/errors";

type QuestionBankForPaper = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: { include: { batchSemester: { include: { academicYear: true } } } };
    slots: {
      include: { assignedQuestion: true };
      where: { assignedQuestionId: { not: null } };
    };
    generatedPapers: {
      include: {
        items: {
          include: { question: true };
        };
      };
    };
  };
}>;

export type GeneratedPaperPayload = {
  variant: PaperVariant;
  selectedQuestions: QuestionLibraryItem[];
  inventoryWarnings: string[];
};

const modules = [1, 2, 3, 4, 5, 6];
const marksPattern = [2, 5, 10] as const;

export class PaperGenerator {
  generate(questionBank: QuestionBankForPaper, variants: PaperVariant[]) {
    const assignedQuestions = questionBank.slots
      .map((slot) => slot.assignedQuestion)
      .filter((q): q is QuestionLibraryItem => q !== null);
    const approvedQuestions = assignedQuestions.filter((question) => question.status === QuestionStatus.APPROVED);
    if (!approvedQuestions.length) throw new AppError("No approved inventory available for paper generation", 409);

    const historicalExclusion = new Set(
      questionBank.generatedPapers.flatMap((paper) => paper.items.map((item) => item.questionId)),
    );

    const consumed = new Set<string>();
    const generated = variants.map((variant) => {
      const selectedQuestions: QuestionLibraryItem[] = [];

      for (const moduleNumber of modules) {
        for (const marks of marksPattern) {
          const candidate = approvedQuestions
            .filter((question) => question.moduleNumber === moduleNumber && question.marks === marks)
            .filter((question) => !consumed.has(question.id))
            .filter((question) => !historicalExclusion.has(question.id))
            .sort((left, right) => this.rankQuestion(left) - this.rankQuestion(right))[0];

          if (!candidate) {
            throw new AppError(`Insufficient approved inventory for ${variant} at Module ${moduleNumber}, ${marks}-mark slot.`, 409);
          }

          selectedQuestions.push(candidate);
          consumed.add(candidate.id);
        }
      }

      const inventoryWarnings = this.inventoryWarnings(approvedQuestions, consumed.size);
      return { variant, selectedQuestions, inventoryWarnings };
    });

    return generated;
  }

  private rankQuestion(question: QuestionLibraryItem) {
    const difficultyWeight = question.difficultyLevel === "MEDIUM" ? 0 : question.difficultyLevel === "EASY" ? 2 : 4;
    return difficultyWeight;
  }

  private inventoryWarnings(approvedQuestions: QuestionLibraryItem[], usedCount: number) {
    const remaining = approvedQuestions.length - usedCount;
    const warnings: string[] = [];
    if (remaining < 5) warnings.push("Remaining approved inventory is below warning threshold (< 5).");
    if (remaining < 2) warnings.push("Remaining approved inventory is below critical threshold (< 2).");
    if (remaining <= 0) warnings.push("Inventory exhausted. Further generation must be blocked.");
    return warnings;
  }
}

