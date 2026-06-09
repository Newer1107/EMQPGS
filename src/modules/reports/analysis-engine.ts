import { CourseOutcome, DifficultyLevel, QuestionStatus, RbtLevel, type Prisma } from "@prisma/client";
import type { AiQuestionBankReport, CoverageMetric, DistributionMetric } from "@/modules/ai/types";

type QuestionBankWithQuestions = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: true;
    questions: true;
  };
}>;

const outcomeOrder = Object.values(CourseOutcome);
const rbtOrder = Object.values(RbtLevel);
const difficultyOrder = Object.values(DifficultyLevel);

export class AnalysisEngine {
  buildDeterministicReport(questionBank: QuestionBankWithQuestions): AiQuestionBankReport {
    const approvedQuestions = questionBank.questions.filter((question) => question.status === QuestionStatus.APPROVED);
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
      remainingWarning: approvedQuestions.length < 5,
      remainingCritical: approvedQuestions.length < 2,
      exhausted: approvedQuestions.length === 0,
    };
    const bloomsBalance = this.assessBloomsBalance(rbtDistribution);

    return {
      moduleCoverage,
      coDistribution,
      rbtDistribution,
      difficultyDistribution,
      duplicates,
      missingAreas,
      qualityFindings,
      bloomsBalance,
      inventory,
      executiveSummary: this.buildExecutiveSummary(questionBank.subject.subjectCode, inventory, duplicates.length, missingAreas.length),
      chartData: {
        moduleCoverage: moduleCoverage.map((metric) => ({ module: metric.label, approved: metric.approved, target: metric.total })),
        coDistribution: coDistribution.map((metric) => ({ label: metric.key, value: metric.count })),
        rbtDistribution: rbtDistribution.map((metric) => ({ label: metric.key, value: metric.count })),
        difficultyDistribution: difficultyDistribution.map((metric) => ({ label: metric.key, value: metric.count })),
      },
    };
  }

  private buildModuleCoverage(moduleNumber: number, questions: QuestionBankWithQuestions["questions"]): CoverageMetric {
    const target = 21;
    const approved = questions.filter((question) => question.moduleNumber === moduleNumber).length;
    return {
      label: `Module ${moduleNumber}`,
      total: target,
      approved,
      missing: Math.max(target - approved, 0),
    };
  }

  private buildDistribution<T extends string>(keys: T[], values: T[]): DistributionMetric[] {
    const total = values.length || 1;
    return keys.map((key) => {
      const count = values.filter((value) => value === key).length;
      return {
        key,
        count,
        percentage: Number(((count / total) * 100).toFixed(2)),
      };
    });
  }

  private detectDuplicates(questions: QuestionBankWithQuestions["questions"]) {
    const duplicates: Array<{ questionId: string; similarToQuestionId: string; score: number }> = [];
    for (let index = 0; index < questions.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < questions.length; compareIndex += 1) {
        const first = normalizeText(questions[index].questionText);
        const second = normalizeText(questions[compareIndex].questionText);
        const score = similarityScore(first, second);
        if (score >= 0.84) {
          duplicates.push({
            questionId: questions[index].id,
            similarToQuestionId: questions[compareIndex].id,
            score: Number(score.toFixed(2)),
          });
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
    const findings: string[] = [];
    moduleCoverage.filter((metric) => metric.missing > 0).forEach((metric) => findings.push(`${metric.label} is missing ${metric.missing} approved questions.`));
    coDistribution.filter((metric) => metric.count === 0).forEach((metric) => findings.push(`No approved coverage for ${metric.key}.`));
    rbtDistribution.filter((metric) => metric.count === 0).forEach((metric) => findings.push(`No approved questions tagged ${metric.key}.`));
    difficultyDistribution.filter((metric) => metric.count === 0).forEach((metric) => findings.push(`Difficulty bucket ${metric.key} is not represented.`));
    return findings;
  }

  private assessQuality(questions: QuestionBankWithQuestions["questions"]) {
    if (!questions.length) {
      return ["No approved questions available for quality analysis."];
    }

    const shortQuestions = questions.filter((question) => question.questionText.trim().length < 40).length;
    const missingTeachingIndex = questions.filter((question) => !question.teachingIndex).length;
    const findings = [
      `${questions.length - shortQuestions}/${questions.length} approved questions exceed the minimum descriptive threshold.`,
      `${questions.length - missingTeachingIndex}/${questions.length} approved questions include a teaching index.`,
    ];

    if (shortQuestions > 0) findings.push(`${shortQuestions} approved questions may be too brief for unambiguous interpretation.`);
    if (missingTeachingIndex > 0) findings.push(`${missingTeachingIndex} approved questions do not include a teaching index.`);
    return findings;
  }

  private assessBloomsBalance(rbtDistribution: DistributionMetric[]) {
    const lower = rbtDistribution.filter((metric) => ["L1", "L2", "L3"].includes(metric.key)).reduce((sum, metric) => sum + metric.count, 0);
    const higher = rbtDistribution.filter((metric) => ["L4", "L5", "L6"].includes(metric.key)).reduce((sum, metric) => sum + metric.count, 0);
    if (higher === 0) return "Bloom's taxonomy is heavily skewed toward lower-order thinking skills.";
    if (Math.abs(lower - higher) <= 2) return "Bloom's taxonomy balance is healthy across lower and higher-order skills.";
    return lower > higher
      ? "Lower-order Bloom's levels dominate the inventory; add more analytical and evaluative questions."
      : "Higher-order Bloom's levels dominate the inventory; include more foundational recall and comprehension questions.";
  }

  private buildExecutiveSummary(subjectCode: string, inventory: AiQuestionBankReport["inventory"], duplicateCount: number, missingAreaCount: number) {
    return `${subjectCode} currently has ${inventory.approvedQuestions} approved questions. Duplicate risk count is ${duplicateCount} and ${missingAreaCount} coverage gaps require moderation attention.`;
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
