import { ExamType, PaperVariant, QuestionStatus, type Prisma, type Question } from "@prisma/client";
import { AppError } from "@/lib/errors";

type QuestionBankForPaper = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: true;
    questions: true;
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
  selectedQuestions: Question[];
  inventoryWarnings: string[];
};

const modules = [1, 2, 3, 4, 5, 6];
const marksPattern = [2, 5, 10] as const;

export class PaperGenerator {
  generate(questionBank: QuestionBankForPaper, variants: PaperVariant[]) {
    const approvedQuestions = questionBank.questions.filter((question) => question.status === QuestionStatus.APPROVED);
    if (!approvedQuestions.length) throw new AppError("No approved inventory available for paper generation", 409);

    const recentlyUsed = new Set(
      approvedQuestions
        .filter(
          (question) =>
            question.lastUsedYear === questionBank.examCycle.academicYear &&
            question.lastUsedSemester === questionBank.examCycle.semester &&
            question.lastUsedType === questionBank.examCycle.examType,
        )
        .map((question) => question.id),
    );

    const historicalExclusion = new Set(
      questionBank.generatedPapers.flatMap((paper) => paper.items.map((item) => item.questionId)),
    );

    const consumed = new Set<string>();
    const generated = variants.map((variant) => {
      const selectedQuestions: Question[] = [];

      for (const moduleNumber of modules) {
        for (const marks of marksPattern) {
          const candidate = approvedQuestions
            .filter((question) => question.moduleNumber === moduleNumber && question.marks === marks)
            .filter((question) => !consumed.has(question.id))
            .filter((question) => !historicalExclusion.has(question.id))
            .filter((question) => !recentlyUsed.has(question.id))
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

  private rankQuestion(question: Question) {
    const usagePenalty = question.usageCount * 10;
    const recencyPenalty = question.lastUsedExam ? 20 : 0;
    const difficultyWeight = question.difficultyLevel === "MEDIUM" ? 0 : question.difficultyLevel === "EASY" ? 2 : 4;
    return usagePenalty + recencyPenalty + difficultyWeight;
  }

  private inventoryWarnings(approvedQuestions: Question[], usedCount: number) {
    const remaining = approvedQuestions.length - usedCount;
    const warnings: string[] = [];
    if (remaining < 5) warnings.push("Remaining approved inventory is below warning threshold (< 5).");
    if (remaining < 2) warnings.push("Remaining approved inventory is below critical threshold (< 2).");
    if (remaining <= 0) warnings.push("Inventory exhausted. Further generation must be blocked.");
    return warnings;
  }

  static toLastUsedExam(examType: ExamType) {
    return examType.replaceAll("_", " ");
  }
}
