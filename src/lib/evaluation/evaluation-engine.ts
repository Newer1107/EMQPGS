// ── Deterministic Evaluation Engine ───────────────────────────────
// Computes ALL metrics, percentages, distributions, scores deterministically.
// AI never computes numbers — it only explains.

import type {
  EvaluationBankData,
  EvaluationQuestion,
  DeterministicEvaluation,
  ModuleSummaryRow,
  ModuleAttributeCompleteness,
  RbtDistribution,
  ModuleRbtDistribution,
  DifficultyDistribution,
  ModuleDifficultyDistribution,
  MarksDistribution,
  ModuleMarksDistribution,
  CoCoverage,
  ModuleQualityMetric,
  ConsolidatedModuleScore,
  EvaluationVerdict,
  QuestionFinding,
} from "./types";

const RBT_LEVELS = ["L1", "L2", "L3", "L4", "L5", "L6"] as const;
const RBT_LABELS: Record<string, keyof RbtDistribution> = {
  L1: "remember",
  L2: "understand",
  L3: "apply",
  L4: "analyze",
  L5: "evaluate",
  L6: "create",
};

export class EvaluationEngine {
  /**
   * Compute ALL deterministic metrics from raw bank data.
   */
  evaluate(data: EvaluationBankData): DeterministicEvaluation {
    const questions = data.questions.filter((q) => q.questionText !== null);
    const modules = [...new Set(questions.map((q) => q.moduleNumber))].sort((a, b) => a - b);

    const moduleSummary = this.computeModuleSummary(data, modules);
    const attributeCompleteness = this.computeAttributeCompleteness(questions, modules);
    const overallCompletenessPct = this.computeOverallCompleteness(attributeCompleteness);
    const overallRbt = this.computeOverallRbt(questions);
    const moduleRbt = this.computeModuleRbt(questions, modules);
    const idealDistribution = this.computeIdealRbt();
    const overallDifficulty = this.computeOverallDifficulty(questions);
    const moduleDifficulty = this.computeModuleDifficulty(questions, modules);
    const overallMarks = this.computeOverallMarks(questions);
    const moduleMarks = this.computeModuleMarks(questions, modules);
    const coCoverage = this.computeCoCoverage(questions, modules);
    const alignmentScore = this.computeAlignmentScore(questions);
    const qualityMetrics = this.computeQualityMetrics(questions, modules);
    const questionFindings = this.computeQuestionFindings(questions);
    const consolidatedScores = this.computeConsolidatedScores(qualityMetrics, attributeCompleteness, modules);
    const overallAverage = this.computeOverallAverage(consolidatedScores);
    const verdict = this.computeVerdict(overallAverage);

    return {
      moduleSummary,
      attributeCompleteness,
      overallCompletenessPct,
      overallRbt,
      moduleRbt,
      idealDistribution,
      overallDifficulty,
      moduleDifficulty,
      overallMarks,
      moduleMarks,
      coCoverage,
      alignmentScore,
      qualityMetrics,
      consolidatedScores,
      overallAverage,
      verdict,
      questionFindings,
    };
  }

  // ── Module Summary ────────────────────────────────────────────

  private computeModuleSummary(data: EvaluationBankData, modules: number[]): ModuleSummaryRow[] {
    return modules.map((mn) => {
      const moduleQuestions = data.questions.filter((q) => q.moduleNumber === mn && q.questionText);
      const filled = moduleQuestions.length;
      const totalMarks = moduleQuestions.reduce((s, q) => s + q.marks, 0);
      const cos = [...new Set(moduleQuestions.map((q) => q.coMapping).filter(Boolean))] as string[];

      // ponytail: category heuristic — if most questions are L1/L2 it's theory, L3/L4 = application, L5/L6 = problem-solving
      const rbtSet = moduleQuestions.map((q) => q.rbtLevel).filter(Boolean);
      const l1l2 = rbtSet.filter((r) => r === "L1" || r === "L2").length;
      const l3l4 = rbtSet.filter((r) => r === "L3" || r === "L4").length;
      const l5l6 = rbtSet.filter((r) => r === "L5" || r === "L6").length;
      const category = l5l6 > l3l4 && l5l6 > l1l2 ? "Problem-solving" : l3l4 > l1l2 ? "Application" : "Theory";

      // ponytail: hours = filled * 2 as heuristic, add when actual data available
      return {
        moduleNumber: mn,
        moduleName: `Module ${mn}`,
        totalSlots: data.totalSlots / modules.length, // approximate
        filledSlots: filled,
        totalMarks,
        category,
        articulation: cos.length > 0 ? cos.join(", ") : "—",
      };
    });
  }

  // ── Attribute Completeness ────────────────────────────────────

  private computeAttributeCompleteness(
    questions: EvaluationQuestion[],
    modules: number[],
  ): ModuleAttributeCompleteness[] {
    return modules.map((mn) => {
      const modQs = questions.filter((q) => q.moduleNumber === mn);
      const total = modQs.length;
      const missingRbt = modQs.filter((q) => !q.rbtLevel).length;
      const missingCo = modQs.filter((q) => !q.coMapping).length;
      const missingDifficulty = modQs.filter((q) => !q.difficultyLevel).length;
      const missingMarks = modQs.filter((q) => q.marks <= 0).length;
      const missingAny = modQs.filter((q) => !q.rbtLevel || !q.coMapping || !q.difficultyLevel || q.marks <= 0).length;
      const metadataComplete = total - missingAny;
      const completenessPct = total > 0 ? Math.round((metadataComplete / total) * 100) : 0;

      return { moduleNumber: mn, totalQuestions: total, metadataComplete, missingRbt, missingCo, missingDifficulty, missingMarks, completenessPct };
    });
  }

  private computeOverallCompleteness(rows: ModuleAttributeCompleteness[]): number {
    const total = rows.reduce((s, r) => s + r.totalQuestions, 0);
    const complete = rows.reduce((s, r) => s + r.metadataComplete, 0);
    return total > 0 ? Math.round((complete / total) * 100) : 0;
  }

  // ── RBT Distribution ──────────────────────────────────────────

  private computeOverallRbt(questions: EvaluationQuestion[]): RbtDistribution {
    const dist: RbtDistribution = { remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0 };
    for (const q of questions) {
      if (q.rbtLevel && RBT_LABELS[q.rbtLevel]) {
        dist[RBT_LABELS[q.rbtLevel]]++;
      }
    }
    return dist;
  }

  private computeModuleRbt(questions: EvaluationQuestion[], modules: number[]): ModuleRbtDistribution[] {
    return modules.map((mn) => {
      const modQs = questions.filter((q) => q.moduleNumber === mn);
      const distribution = this.computeOverallRbt(modQs);
      const total = Object.values(distribution).reduce((s, c) => s + c, 0);
      return { moduleNumber: mn, distribution, total };
    });
  }

  private computeIdealRbt(): RbtDistribution {
    // ponytail: 10% remember, 20% understand, 30% apply, 20% analyze, 10% evaluate, 10% create
    return { remember: 10, understand: 20, apply: 30, analyze: 20, evaluate: 10, create: 10 };
  }

  // ── Difficulty Distribution ───────────────────────────────────

  private computeOverallDifficulty(questions: EvaluationQuestion[]): DifficultyDistribution {
    const dist: DifficultyDistribution = { easy: 0, medium: 0, hard: 0 };
    for (const q of questions) {
      if (q.difficultyLevel === "EASY") dist.easy++;
      else if (q.difficultyLevel === "MEDIUM") dist.medium++;
      else if (q.difficultyLevel === "HARD") dist.hard++;
    }
    return dist;
  }

  private computeModuleDifficulty(questions: EvaluationQuestion[], modules: number[]): ModuleDifficultyDistribution[] {
    return modules.map((mn) => {
      const modQs = questions.filter((q) => q.moduleNumber === mn);
      const distribution = this.computeOverallDifficulty(modQs);
      const total = Object.values(distribution).reduce((s, c) => s + c, 0);
      return { moduleNumber: mn, distribution, total };
    });
  }

  // ── Marks Distribution ────────────────────────────────────────

  private computeOverallMarks(questions: EvaluationQuestion[]): MarksDistribution {
    const dist: MarksDistribution = {};
    for (const q of questions) {
      dist[q.marks] = (dist[q.marks] ?? 0) + 1;
    }
    return dist;
  }

  private computeModuleMarks(questions: EvaluationQuestion[], modules: number[]): ModuleMarksDistribution[] {
    return modules.map((mn) => {
      const modQs = questions.filter((q) => q.moduleNumber === mn);
      const distribution = this.computeOverallMarks(modQs);
      const total = Object.values(distribution).reduce((s, c) => s + c, 0);
      return { moduleNumber: mn, distribution, total };
    });
  }

  // ── CO Coverage ───────────────────────────────────────────────

  private computeCoCoverage(questions: EvaluationQuestion[], modules: number[]): CoCoverage[] {
    const coMap = new Map<string, Set<number>>();
    for (const q of questions) {
      if (q.coMapping) {
        if (!coMap.has(q.coMapping)) coMap.set(q.coMapping, new Set());
        coMap.get(q.coMapping)!.add(q.moduleNumber);
      }
    }

    return Array.from(coMap.entries())
      .map(([co, modSet]) => ({
        co,
        totalQuestions: questions.filter((q) => q.coMapping === co).length,
        modules: Array.from(modSet).sort(),
        coveragePct: Math.round((modSet.size / modules.length) * 100),
      }))
      .sort((a, b) => a.co.localeCompare(b.co));
  }

  // ── Constructive Alignment ────────────────────────────────────

  private computeAlignmentScore(questions: EvaluationQuestion[]): number {
    // Alignment = % of questions where CO + RBT + difficulty are all present and consistent
    const aligned = questions.filter((q) => {
      if (!q.coMapping || !q.rbtLevel || !q.difficultyLevel) return false;
      // ponytail: basic consistency — check marks ≤ 2 map to L1/L2
      if (q.marks <= 2) return q.rbtLevel === "L1" || q.rbtLevel === "L2";
      return true;
    }).length;
    return questions.length > 0 ? aligned / questions.length : 0;
  }

  // ── Quality Metrics ───────────────────────────────────────────

  private computeQualityMetrics(questions: EvaluationQuestion[], modules: number[]): ModuleQualityMetric[] {
    return modules.map((mn) => {
      const modQs = questions.filter((q) => q.moduleNumber === mn);
      if (modQs.length === 0) {
        return { moduleNumber: mn, clarity: 0, relevance: 0, rbtAccuracy: 0, poPiCoverage: 0, remarks: "No questions" };
      }

      // Clarity: heuristic based on question text length and completeness
      const clarity = modQs.reduce((s, q) => {
        if (!q.questionText) return s;
        const text = q.questionText.trim();
        const hasVerb = /^[A-Z]/.test(text); // starts with capital (well-formed)
        const reasonableLength = text.length > 20 && text.length < 500;
        const hasMetadata = !!(q.coMapping && q.rbtLevel && q.difficultyLevel);
        return s + (hasVerb && reasonableLength && hasMetadata ? 1 : hasVerb && reasonableLength ? 0.6 : 0.3);
      }, 0) / modQs.length;

      // Relevance: CO mapping presence
      const relevance = modQs.filter((q) => q.coMapping).length / modQs.length;

      // RBT Accuracy: RBT level presence
      const rbtAccuracy = modQs.filter((q) => q.rbtLevel).length / modQs.length;

      // PO/PI Coverage: not in current schema, default to 0
      const poPiCoverage = 0;

      const remarks = this.generateQualityRemark(clarity, relevance, rbtAccuracy);

      return { moduleNumber: mn, clarity: round(clarity), relevance: round(relevance), rbtAccuracy: round(rbtAccuracy), poPiCoverage, remarks };
    });
  }

  private generateQualityRemark(clarity: number, relevance: number, rbtAccuracy: number): string {
    const score = (clarity + relevance + rbtAccuracy) / 3;
    if (score >= 0.8) return "Well-structured module with clear, relevant questions.";
    if (score >= 0.6) return "Adequately structured; some questions may need refinement.";
    return "Needs significant improvement in question structure and metadata completeness.";
  }

  // ── Consolidated Scores ───────────────────────────────────────

  private computeConsolidatedScores(
    qualityMetrics: ModuleQualityMetric[],
    completeness: ModuleAttributeCompleteness[],
    modules: number[],
  ): ConsolidatedModuleScore[] {
    return modules.map((mn) => {
      const qm = qualityMetrics.find((m) => m.moduleNumber === mn);
      const comp = completeness.find((m) => m.moduleNumber === mn);
      const clarity = qm?.clarity ?? 0;
      const relevance = qm?.relevance ?? 0;
      const rbtAccuracy = qm?.rbtAccuracy ?? 0;
      const completenessScore = comp ? comp.completenessPct / 100 : 0;
      const average = round((clarity + relevance + rbtAccuracy + completenessScore) / 4);
      return {
        moduleNumber: mn,
        clarity,
        relevance,
        rbtAccuracy,
        completeness: completenessScore,
        average,
        overallScore: round(average), // same as average in simple mode
      };
    });
  }

  private computeOverallAverage(scores: ConsolidatedModuleScore[]): number {
    if (scores.length === 0) return 0;
    return round(scores.reduce((s, m) => s + m.average, 0) / scores.length);
  }

  // ── Verdict ───────────────────────────────────────────────────

  private computeVerdict(overallAverage: number): EvaluationVerdict {
    // Thresholds: >= 0.8 Highly Effective, >= 0.6 Moderately Effective, < 0.6 Needs Revision
    const verdict = overallAverage >= 0.8
      ? "Highly Effective" as const
      : overallAverage >= 0.6
        ? "Moderately Effective" as const
        : "Needs Revision" as const;

    return {
      verdict,
      overallScore: overallAverage,
      thresholds: { highlyEffective: 0.8, moderatelyEffective: 0.6, needsRevision: 0 },
    };
  }

  // ── Question-Level Findings ───────────────────────────────────

  private computeQuestionFindings(questions: EvaluationQuestion[]): QuestionFinding[] {
    const findings: QuestionFinding[] = [];

    for (const q of questions) {
      const problems: string[] = [];
      const consequences: string[] = [];
      const recommendations: string[] = [];

      // Check missing metadata
      if (!q.coMapping) {
        problems.push("Missing CO mapping");
        consequences.push("Cannot track outcome attainment");
        recommendations.push("Assign an appropriate Course Outcome (CO1-CO6)");
      }

      if (!q.rbtLevel) {
        problems.push("Missing RBT classification");
        consequences.push("Cognitive level cannot be verified");
        recommendations.push("Classify using Revised Bloom's Taxonomy (L1-L6)");
      }

      if (!q.difficultyLevel) {
        problems.push("Missing difficulty level");
        consequences.push("Assessment balance cannot be evaluated");
        recommendations.push("Set difficulty to Easy, Medium, or Hard");
      }

      // Check RBT vs marks alignment
      if (q.rbtLevel && q.marks > 0) {
        const rbtNum = parseInt(q.rbtLevel.replace("L", ""), 10);
        if (q.marks <= 2 && rbtNum > 2) {
          problems.push(`RBT ${q.rbtLevel} with ${q.marks} marks may be misaligned`);
          consequences.push("Low-mark questions should target lower-order cognitive skills");
          recommendations.push("Consider reducing RBT level or increasing marks");
        }
        if (q.marks >= 10 && rbtNum < 4) {
          problems.push(`Low RBT level (${q.rbtLevel}) for high-mark (${q.marks}) question`);
          consequences.push("High-mark questions should demonstrate higher-order thinking");
          recommendations.push("Consider raising RBT level to Analyze, Evaluate, or Create");
        }
      }

      if (problems.length > 0) {
        findings.push({
          slotId: q.slotId,
          moduleNumber: q.moduleNumber,
          marks: q.marks,
          currentRbt: q.rbtLevel,
          difficulty: q.difficultyLevel,
          co: q.coMapping,
          problem: problems.join("; "),
          pedagogicalConsequence: consequences.join("; "),
          recommendation: recommendations.join("; "),
          confidence: 92, // ponytail: fixed high confidence for deterministic checks
        });
      }
    }

    return findings;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
