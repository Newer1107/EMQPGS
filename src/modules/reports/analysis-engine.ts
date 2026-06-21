import { CourseOutcome, DifficultyLevel, QuestionStatus, RbtLevel, type Prisma } from "@prisma/client";
import type { AiQuestionBankReport, CoverageMetric, DistributionMetric } from "@/modules/ai/types";

type QuestionBankWithQuestions = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    pattern: true;
    slots: {
      include: { assignedQuestion: true };
      where: { assignedQuestionId: { not: null } };
    };
  };
}>;

const outcomeOrder = Object.values(CourseOutcome);
const rbtOrder = Object.values(RbtLevel);
const difficultyOrder = Object.values(DifficultyLevel);

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "can", "could",
  "shall", "should", "may", "might", "must", "to", "of", "in", "for", "on",
  "with", "at", "by", "from", "as", "into", "through", "during", "before",
  "after", "above", "below", "between", "out", "off", "over", "under",
  "again", "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same",
  "so", "than", "too", "very", "just", "because", "but", "and", "or",
  "if", "while", "that", "this", "these", "those", "it", "its",
  "what", "which", "who", "whom", "whose", "about", "explain", "define",
  "describe", "list", "state", "discuss", "write", "what", "compute",
  "find", "show", "prove", "derive", "solve", "evaluate", "determine",
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export class AnalysisEngine {
  buildDeterministicReport(questionBank: QuestionBankWithQuestions): AiQuestionBankReport {
    const questions = questionBank.slots
      .map((slot) => slot.assignedQuestion)
      .filter((q): q is NonNullable<typeof q> => q !== null);
    const approvedQuestions = questions.filter((question) => question.status === QuestionStatus.APPROVED);

    const totalModules = questionBank.pattern?.totalModules ?? 6;
    const marksOptions = (questionBank.pattern?.marksPattern as number[]) ?? [2, 5, 10];
    const slotsPerModule = questionBank.pattern?.slotsPerModule ?? 7;
    const moduleTargetTotal = marksOptions.length * slotsPerModule;

    const moduleCoverage = Array.from({ length: totalModules }, (_, index) =>
      this.buildModuleCoverage(index + 1, moduleTargetTotal, approvedQuestions),
    );
    const coDistribution = this.buildDistribution(outcomeOrder, approvedQuestions.map((question) => question.coMapping));
    const rbtDistribution = this.buildDistribution(rbtOrder, approvedQuestions.map((question) => question.rbtLevel));
    const difficultyDistribution = this.buildDistribution(
      difficultyOrder,
      approvedQuestions.map((question) => question.difficultyLevel).filter(Boolean) as DifficultyLevel[],
    );
    const duplicates = this.detectDuplicates(approvedQuestions);
    const missingAreas = this.findMissingAreas(moduleCoverage, coDistribution, rbtDistribution, difficultyDistribution);
    const qualityFindings = this.assessQuality(difficultyDistribution);
    const inventory = {
      approvedQuestions: approvedQuestions.length,
      remainingWarning: approvedQuestions.length > 0 && approvedQuestions.length < totalModules * marksOptions.length,
      remainingCritical: approvedQuestions.length > 0 && approvedQuestions.length < totalModules,
      exhausted: approvedQuestions.length === 0,
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
      inventory,
      executiveSummary: "",
      chartData: {
        moduleCoverage: moduleCoverage.map((m) => ({ module: `Module ${m.label}`, approved: m.approved, target: m.total })),
        coDistribution: coDistribution.map((c) => ({ label: c.key, value: c.count })),
        rbtDistribution: rbtDistribution.map((r) => ({ label: r.key, value: r.count })),
        difficultyDistribution: difficultyDistribution.map((d) => ({ label: d.key, value: d.count })),
      },
    };
  }

  private buildModuleCoverage(moduleNumber: number, targetTotal: number, questions: Array<{ moduleNumber: number; status: QuestionStatus }>): CoverageMetric {
    return {
      label: String(moduleNumber),
      total: targetTotal,
      approved: questions.filter((question) => question.moduleNumber === moduleNumber).length,
      missing: targetTotal - questions.filter((question) => question.moduleNumber === moduleNumber).length,
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

  private detectDuplicates(
    questions: Array<{ id: string; questionText: string }>,
    threshold = 0.7,
  ): Array<{ questionId: string; similarToQuestionId: string; score: number }> {
    const tokens = questions.map((q) => new Set(normalize(q.questionText)));
    const results: Array<{ questionId: string; similarToQuestionId: string; score: number }> = [];
    for (let i = 0; i < questions.length; i++) {
      for (let j = i + 1; j < questions.length; j++) {
        const score = jaccardSimilarity(tokens[i], tokens[j]);
        if (score >= threshold) {
          results.push({ questionId: questions[i].id, similarToQuestionId: questions[j].id, score: Math.round(score * 100) / 100 });
        }
      }
    }
    return results;
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
    for (const diff of difficultyDistribution) {
      if (diff.count === 0) missing.push(`${diff.key} difficulty has no questions.`);
    }
    return missing;
  }

  private assessQuality(difficultyDistribution: DistributionMetric[]): string[] {
    const findings: string[] = [];
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
