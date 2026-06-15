import { CourseOutcome, DifficultyLevel, QuestionStatus, RbtLevel, type Prisma } from "@prisma/client";
import type { AiQuestionBankReport, CoverageMetric, DistributionMetric } from "@/modules/ai/types";

type QuestionBankWithQuestions = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: true;
    bankQuestions: { include: { question: true } };
  };
}>;

const outcomeOrder = Object.values(CourseOutcome);
const rbtOrder = Object.values(RbtLevel);
const difficultyOrder = Object.values(DifficultyLevel);

export class AnalysisEngine {
  buildDeterministicReport(questionBank: QuestionBankWithQuestions): AiQuestionBankReport {
    const approvedQuestions = questionBank.bankQuestions
      .map((bq) => bq.question)
      .filter((question) => question.status === QuestionStatus.APPROVED);
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

  private buildDistribution(keys: readonly string[], values: string[]): DistributionMetric[] {
    const counts: Record<string, number> = {};
    for (const key of keys) counts[key] = 0;
    for (const value of values) {
      if (value in counts) counts[value] += 1;
    }
    const total = values.length || 1;
    return keys.map((key) => ({
      key,
      count: counts[key] ?? 0,
      percentage: Number(((counts[key] ?? 0) / total * 100).toFixed(2)),
    }));
  }

  private detectDuplicates(questions: Array<{ id: string; questionText: string }>) {
    const duplicates: Array<{ questionId: string; similarToQuestionId: string; score: number }> = [];
    for (let index = 0; index < questions.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < questions.length; compareIndex += 1) {
        const first = normalizeText(questions[index].questionText);
        const second = normalizeText(questions[compareIndex].questionText);
        const score = similarityScore(first, second);
        if (score >= 0.84) {
          duplicates.push({ questionId: questions[index].id, similarToQuestionId: questions[compareIndex].id, score });
        }
      }
    }
    return duplicates;
  }

  private findMissingAreas(
    moduleCoverage: CoverageMetric[],
    coDistribution: DistributionMetric[],
    rbtDistribution: DistributionMetric[],
    difficultyDistribution: DistributionMetric[],
  ) {
    return [
      ...moduleCoverage.filter((m) => m.approved === 0).map((m) => `Module ${m.label}: no approved questions`),
      ...coDistribution.filter((c) => c.count === 0).map((c) => `${c.key}: no questions`),
      ...rbtDistribution.filter((r) => r.count === 0).map((r) => `${r.key}: no questions`),
      ...difficultyDistribution.filter((d) => d.count === 0).map((d) => `${d.key}: no questions`),
    ];
  }

  private assessQuality(questions: Array<{ questionText: string; teachingIndex: string | null }>) {
    return questions.map((question) => {
      const issues: string[] = [];
      if (question.questionText.length < 40) issues.push("Question text is too short");
      if (!question.teachingIndex) issues.push("Teaching index is missing");
      return issues.length > 0 ? `Q: ${question.questionText.slice(0, 60)}... ${issues.join("; ")}` : "";
    }).filter(Boolean);
  }

  private assessBloomsBalance(rbtDistribution: DistributionMetric[]) {
    const lowerOrder = rbtDistribution.filter((r) => ["L1", "L2", "L3"].includes(r.key)).reduce((sum, r) => sum + r.count, 0);
    const higherOrder = rbtDistribution.filter((r) => ["L4", "L5", "L6"].includes(r.key)).reduce((sum, r) => sum + r.count, 0);
    return `Higher-order: ${higherOrder}, Lower-order: ${lowerOrder}${lowerOrder > 0 ? `, Ratio: ${(higherOrder / lowerOrder).toFixed(2)}` : ""}`;
  }
}

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function similarityScore(first: string, second: string) {
  if (!first || !second) return 0;
  if (first === second) return 1;
  const firstTokens = new Set(first.split(" "));
  const secondTokens = new Set(second.split(" "));
  const intersection = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const union = new Set([...firstTokens, ...secondTokens]).size;
  return intersection / union;
}
