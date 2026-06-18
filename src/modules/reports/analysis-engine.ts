import { CourseOutcome, DifficultyLevel, QuestionStatus, RbtLevel, type Prisma } from "@prisma/client";
import type { AiQuestionBankReport, CoverageMetric, DistributionMetric } from "@/modules/ai/types";

type QuestionBankWithQuestions = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: true;
    slots: {
      include: { assignedQuestion: true };
      where: { assignedQuestionId: { not: null } };
    };
  };
}>;

const outcomeOrder = Object.values(CourseOutcome);
const rbtOrder = Object.values(RbtLevel);
const difficultyOrder = Object.values(DifficultyLevel);

export class AnalysisEngine {
  buildDeterministicReport(questionBank: QuestionBankWithQuestions): AiQuestionBankReport {
    const questions = questionBank.slots
      .map((slot) => slot.assignedQuestion)
      .filter((q): q is NonNullable<typeof q> => q !== null);
    const approvedQuestions = questions.filter((question) => question.status === QuestionStatus.APPROVED);
    const moduleCoverage = Array.from({ length: 6 }, (_, index) => this.buildModuleCoverage(index + 1, approvedQuestions));
    const coDistribution = this.buildDistribution(outcomeOrder, approvedQuestions.map((question) => question.coMapping));
    const rbtDistribution = this.buildDistribution(rbtOrder, approvedQuestions.map((question) => question.rbtLevel));
    const difficultyDistribution = this.buildDistribution(
      difficultyOrder,
      approvedQuestions.map((question) => question.difficultyLevel).filter(Boolean) as DifficultyLevel[],
    );
    const duplicates = this.detectDuplicates(approvedQuestions);
    const missingAreas = this.findMissingAreas(moduleCoverage, coDistribution, rbtDistribution, difficultyDistribution);
    const qualityFindings = this.assessQuality(approvedQuestions);
    const inventory = {
      approvedQuestions: approvedQuestions.length,
    };

    return {
      moduleCoverage,
      coDistribution,
      rbtDistribution,
      difficultyDistribution,
      duplicates,
      missingAreas,
      qualityFindings,
      bloomsBalance: this.assessBloomsBalance(rbtDistribution),
      inventory: { ...inventory, remainingWarning: false, remainingCritical: false, exhausted: false },
      executiveSummary: "",
      chartData: {
        moduleCoverage: moduleCoverage.map((m) => ({ module: `Module ${m.label}`, approved: m.approved, target: m.total })),
        coDistribution: coDistribution.map((c) => ({ label: c.key, value: c.count })),
        rbtDistribution: rbtDistribution.map((r) => ({ label: r.key, value: r.count })),
        difficultyDistribution: difficultyDistribution.map((d) => ({ label: d.key, value: d.count })),
      },
    };
  }

  private buildModuleCoverage(moduleNumber: number, questions: Array<{ moduleNumber: number; status: QuestionStatus }>): CoverageMetric {
    return {
      label: String(moduleNumber),
      total: 21,
      approved: questions.filter((question) => question.moduleNumber === moduleNumber).length,
      missing: 21 - questions.filter((question) => question.moduleNumber === moduleNumber).length,
    };
  }

  private buildDistribution<T extends string>(order: readonly T[], values: T[]): DistributionMetric[] {
    const countMap = new Map<T, number>();
    for (const value of order) countMap.set(value, 0);
    for (const value of values) countMap.set(value, (countMap.get(value) ?? 0) + 1);
    return Array.from(countMap.entries()).map(([key, count]) => ({
      key,
      count,
      percentage: values.length > 0 ? Math.round((count / values.length) * 100) : 0,
    }));
  }

  private detectDuplicates(questions: Array<{ id: string; questionText: string }>): Array<{ questionId: string; similarToQuestionId: string; score: number }> {
    return [];
  }

  private findMissingAreas(
    moduleCoverage: CoverageMetric[],
    coDistribution: DistributionMetric[],
    rbtDistribution: DistributionMetric[],
    difficultyDistribution: DistributionMetric[],
  ): string[] {
    const missing: string[] = [];
    for (const mod of moduleCoverage) {
      if (mod.missing === mod.total) missing.push(`Module ${mod.label} has no approved questions.`);
    }
    for (const outcome of coDistribution) {
      if (outcome.count === 0) missing.push(`${outcome.key} has no questions.`);
    }
    for (const rbt of rbtDistribution) {
      if (rbt.count === 0) missing.push(`${rbt.key} level not represented.`);
    }
    return missing;
  }

  private assessQuality(questions: Array<{ difficultyLevel: string | null }>): string[] {
    const findings: string[] = [];
    const difficultyDistribution = this.buildDistribution(
      difficultyOrder,
      questions.map((q) => q.difficultyLevel).filter(Boolean) as DifficultyLevel[],
    );
    const easyCount = difficultyDistribution.find((d) => d.key === DifficultyLevel.EASY)?.count ?? 0;
    const hardCount = difficultyDistribution.find((d) => d.key === DifficultyLevel.HARD)?.count ?? 0;
    if (easyCount > hardCount * 2) findings.push("Disproportionately many easy questions.");
    if (hardCount > easyCount * 2) findings.push("Disproportionately many hard questions.");
    return findings;
  }

  private assessBloomsBalance(rbtDistribution: DistributionMetric[]): string {
    const lowerOrder = rbtDistribution.filter((r) => ["L1", "L2", "L3"].includes(r.key)).reduce((sum, r) => sum + r.count, 0);
    const higherOrder = rbtDistribution.filter((r) => ["L4", "L5", "L6"].includes(r.key)).reduce((sum, r) => sum + r.count, 0);
    const total = lowerOrder + higherOrder;
    if (total === 0) return "No questions to assess.";
    const lowerPct = Math.round((lowerOrder / total) * 100);
    return lowerPct > 70 ? "Heavy lower-order focus. Consider adding L4–L6 questions." : lowerPct < 30 ? "Heavy higher-order focus. Consider adding L1–L3 questions." : "Balanced Bloom's taxonomy distribution.";
  }
}
