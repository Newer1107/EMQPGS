import type { QuestionUsageHistory } from "@prisma/client";
import type {
  SlotAssignment,
  EvaluationReport,
  EvaluationProfile,
  CriterionDetail,
  CriterionExplanation,
  DetailedEvaluationReport,
  ScoreCategory,
} from "./types";
import { DIFFICULTY_VALUE, BLOOM_LEVELS, DEFAULT_TCET_PROFILE } from "./types";

/** Scaling factor for difficulty deviation penalty. */
const DIFFICULTY_FACTOR = 20;

export class EvaluationEngine {
  private readonly profile: EvaluationProfile;
  private readonly usageHistory: QuestionUsageHistory[];

  constructor(profile: EvaluationProfile, usageHistory: QuestionUsageHistory[]) {
    this.profile = profile;
    this.usageHistory = usageHistory;
  }

  evaluate(assignments: SlotAssignment[]): DetailedEvaluationReport {
    const details: CriterionDetail[] = [
      this.scoreDifficultyBalance(assignments),
      this.scoreBloomBalance(assignments),
      this.scoreConceptDiversity(assignments),
      this.scoreFreshness(assignments),
      this.scoreModuleBalance(assignments),
      this.scoreEstimatedSolveTime(assignments),
    ];

    const categories: ScoreCategory[] = details.map((d) => ({
      label: d.label,
      earned: d.earned,
      max: d.max,
      deductions: d.explanations.map((e) => e.message),
    }));

    const overall = categories.reduce((s, c) => s + Math.round(c.earned * 100) / 100, 0);
    const summary = `Score: ${Math.round(overall)}/100 (${this.profile.name})`;

    return { overall, categories, summary, details };
  }

  /* ─── Difficulty Balance ────────────────────── */

  private scoreDifficultyBalance(assignments: SlotAssignment[]): CriterionDetail {
    const max = this.profile.weights.difficultyBalance;
    const explanations: CriterionExplanation[] = [];
    if (assignments.length === 0) return { label: "Difficulty Balance", earned: 0, max, explanations };

    // --- 1. Overall difficulty (50%) ---
    const overallMax = max * 0.5;
    const avg =
      assignments.reduce((s, a) => s + DIFFICULTY_VALUE[a.question.difficultyLevel ?? "MEDIUM"], 0) /
      assignments.length;
    const diff = Math.abs(avg - this.profile.difficulty.targetValue);
    const overallScore = Math.max(0, overallMax - diff * DIFFICULTY_FACTOR * 0.5);

    if (diff > 0.1) {
      explanations.push({
        message: `Avg difficulty ${avg.toFixed(2)} deviates from target ${this.profile.difficulty.targetValue}`,
        affectedQuestionIds: [],
      });
    }

    // --- 2. Per-module difficulty (35%) ---
    const perModuleMax = max * 0.35;
    const moduleData: Record<number, { values: number[]; qIds: string[] }> = {};
    for (const a of assignments) {
      const m = a.slot.moduleNumber;
      if (!moduleData[m]) moduleData[m] = { values: [], qIds: [] };
      moduleData[m].values.push(DIFFICULTY_VALUE[a.question.difficultyLevel ?? "MEDIUM"]);
      moduleData[m].qIds.push(a.question.id);
    }

    const moduleAvgs = Object.entries(moduleData).map(([m, d]) => ({
      module: Number(m),
      avg: d.values.reduce((s, v) => s + v, 0) / d.values.length,
      qIds: d.qIds,
    }));

    let moduleScore = perModuleMax;
    if (moduleAvgs.length > 0) {
      let totalDeviation = 0;
      const outlierModules: { module: number; avg: number; qIds: string[] }[] = [];
      for (const m of moduleAvgs) {
        const dev = Math.abs(m.avg - this.profile.difficulty.targetValue);
        totalDeviation += dev;
        if (dev > 0.3) outlierModules.push(m);
      }
      const avgDeviation = totalDeviation / moduleAvgs.length;
      moduleScore = Math.max(0, perModuleMax - avgDeviation * perModuleMax * this.profile.difficulty.perModuleWeight);

      for (const om of outlierModules) {
        explanations.push({
          message: `Module ${om.module} avg (${om.avg.toFixed(2)}) deviates from target (${this.profile.difficulty.targetValue})`,
          affectedQuestionIds: om.qIds,
        });
      }
    }

    // --- 3. Progression (15%) ---
    const progressionMax = max * 0.15;
    let progressionScore = progressionMax;

    if (moduleAvgs.length >= 2) {
      moduleAvgs.sort((a, b) => a.module - b.module);
      let upward = 0;
      let downward = 0;
      for (let i = 1; i < moduleAvgs.length; i++) {
        if (moduleAvgs[i].avg > moduleAvgs[i - 1].avg) upward++;
        else if (moduleAvgs[i].avg < moduleAvgs[i - 1].avg) downward++;
      }

      if (upward > downward) {
        progressionScore = progressionMax;
      } else if (upward === downward && upward === 0) {
        // flat – slight penalty (progressionWeight damps)
        progressionScore = progressionMax * (1 - this.profile.difficulty.progressionWeight);
        explanations.push({
          message: `Difficulty is flat across ${moduleAvgs.length} modules (no upward trend)`,
          affectedQuestionIds: assignments.map((a) => a.question.id),
        });
      } else {
        // downward trend – larger penalty
        progressionScore = Math.max(0, progressionMax * (1 - this.profile.difficulty.progressionWeight * 2));
        explanations.push({
          message: `Difficulty trends downward (${downward} downward steps vs ${upward} upward)`,
          affectedQuestionIds: assignments.map((a) => a.question.id),
        });
      }
    }

    const earned = Math.round((overallScore + moduleScore + progressionScore) * 100) / 100;
    return { label: "Difficulty Balance", earned, max, explanations };
  }

  /* ─── Bloom Balance ─────────────────────────── */

  private scoreBloomBalance(assignments: SlotAssignment[]): CriterionDetail {
    const max = this.profile.weights.bloomBalance;
    const explanations: CriterionExplanation[] = [];
    if (assignments.length === 0) return { label: "Bloom Balance", earned: 0, max, explanations };

    const counts: Record<string, number> = {};
    for (const a of assignments) {
      const level = a.question.rbtLevel;
      counts[level] = (counts[level] ?? 0) + 1;
    }

    const uniqueLevels = Object.keys(counts).length;
    if (uniqueLevels <= 1) {
      const used = uniqueLevels === 0 ? "none" : Object.keys(counts)[0];
      explanations.push({
        message: `Only ${used} Bloom level(s) used`,
        affectedQuestionIds: assignments.map((a) => a.question.id),
      });
      return { label: "Bloom Balance", earned: 0, max, explanations };
    }

    const n = assignments.length;

    // --- 1. Overall distribution (50%) ---
    const overallMax = max * 0.5;
    let overlap = 0;
    for (const level of BLOOM_LEVELS) {
      const expected = (this.profile.bloom.targetDistribution[level] ?? (1 / BLOOM_LEVELS.length)) * n;
      const actual = counts[level] ?? 0;
      overlap += Math.min(expected, actual);
    }
    const similarity = n > 0 ? overlap / n : 0;
    const overallScore = overallMax * similarity;

    if (similarity < 0.8) {
      const underRep = BLOOM_LEVELS.filter(
        (l) => (counts[l] ?? 0) < ((this.profile.bloom.targetDistribution[l] ?? (1 / BLOOM_LEVELS.length)) * n * 0.5),
      );
      const overRep = BLOOM_LEVELS.filter(
        (l) => (counts[l] ?? 0) > ((this.profile.bloom.targetDistribution[l] ?? (1 / BLOOM_LEVELS.length)) * n * 1.5),
      );
      const parts: string[] = [];
      if (underRep.length) parts.push(`under:${underRep.join(",")}`);
      if (overRep.length) parts.push(`over:${overRep.join(",")}`);
      explanations.push({
        message: `Bloom distribution deviates from target (${parts.join("; ")})`,
        affectedQuestionIds: assignments
          .filter((a) => overRep.includes(a.question.rbtLevel) || underRep.includes(a.question.rbtLevel))
          .map((a) => a.question.id),
      });
    }

    // --- 2. Per-module bloom (30%) ---
    const perModuleMax = max * 0.3;
    const moduleBloom: Record<number, Set<string>> = {};
    const moduleQIds: Record<number, string[]> = {};
    for (const a of assignments) {
      const m = a.slot.moduleNumber;
      if (!moduleBloom[m]) {
        moduleBloom[m] = new Set();
        moduleQIds[m] = [];
      }
      moduleBloom[m].add(a.question.rbtLevel);
      moduleQIds[m].push(a.question.id);
    }

    const moduleEntries = Object.keys(moduleBloom).map(Number);
    let totalBloomPenalty = 0;
    for (const m of moduleEntries) {
      const uniq = moduleBloom[m].size;
      if (uniq <= 1) {
        totalBloomPenalty += 1;
        explanations.push({
          message: `Module ${m} has only 1 Bloom level (${[...moduleBloom[m]][0]})`,
          affectedQuestionIds: moduleQIds[m],
        });
      } else if (uniq <= 2) {
        totalBloomPenalty += 0.5;
        explanations.push({
          message: `Module ${m} has only ${uniq} Bloom levels`,
          affectedQuestionIds: moduleQIds[m],
        });
      }
    }
    const avgBloomPenalty = moduleEntries.length > 0 ? totalBloomPenalty / moduleEntries.length : 0;
    const moduleScore = perModuleMax * (1 - avgBloomPenalty * this.profile.bloom.perModuleWeight);

    // --- 3. Progression (20%) ---
    const progressionMax = max * 0.2;
    let progressionScore = progressionMax;

    if (moduleEntries.length >= 2) {
      const moduleL4Plus: Record<number, { count: number; total: number }> = {};
      for (const a of assignments) {
        const m = a.slot.moduleNumber;
        if (!moduleL4Plus[m]) moduleL4Plus[m] = { count: 0, total: 0 };
        moduleL4Plus[m].total++;
        if (["L4", "L5", "L6"].includes(a.question.rbtLevel)) {
          moduleL4Plus[m].count++;
        }
      }

      const sorted = Object.entries(moduleL4Plus)
        .map(([m, d]) => ({ module: Number(m), ratio: d.total > 0 ? d.count / d.total : 0 }))
        .sort((a, b) => a.module - b.module);

      let upward = 0;
      let downward = 0;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].ratio > sorted[i - 1].ratio) upward++;
        else if (sorted[i].ratio < sorted[i - 1].ratio) downward++;
      }

      if (upward >= downward && upward > 0) {
        progressionScore = progressionMax;
      } else if (upward === 0 && downward === 0) {
        progressionScore = progressionMax * (1 - this.profile.bloom.progressionWeight);
        explanations.push({
          message: `Bloom progression flat across ${sorted.length} modules`,
          affectedQuestionIds: assignments.map((a) => a.question.id),
        });
      } else {
        progressionScore = Math.max(0, progressionMax * (1 - this.profile.bloom.progressionWeight * 2));
        explanations.push({
          message: `Higher-order thinking declines in later modules (${downward} downward steps)`,
          affectedQuestionIds: assignments.map((a) => a.question.id),
        });
      }
    }

    const earned = Math.round((overallScore + moduleScore + progressionScore) * 100) / 100;
    return { label: "Bloom Balance", earned, max, explanations };
  }

  /* ─── Concept Diversity ─────────────────────── */

  private scoreConceptDiversity(assignments: SlotAssignment[]): CriterionDetail {
    const max = this.profile.weights.conceptDiversity;
    const explanations: CriterionExplanation[] = [];
    if (assignments.length === 0) return { label: "Concept Diversity", earned: 0, max, explanations };

    // --- 1. Overall diversity (60%) ---
    const overallMax = max * 0.6;
    const concepts = assignments.map((a) => a.question.teachingIndex).filter((t): t is string => t !== null);
    const unique = new Set(concepts);
    const uniqueRatio = assignments.length > 0 ? unique.size / assignments.length : 0;
    const overallScore = overallMax * Math.min(1, uniqueRatio);

    const duplicateConceptIds: string[] = [];
    const conceptCount: Record<string, string[]> = {};
    for (const a of assignments) {
      const idx = a.question.teachingIndex;
      if (idx) {
        if (!conceptCount[idx]) conceptCount[idx] = [];
        conceptCount[idx].push(a.question.id);
      }
    }
    for (const ids of Object.values(conceptCount)) {
      if (ids.length > 1) duplicateConceptIds.push(...ids);
    }

    if (unique.size < assignments.length) {
      const dupCount = assignments.length - unique.size;
      explanations.push({
        message: `${dupCount} duplicate or missing concept group(s) (${unique.size}/${assignments.length} unique)`,
        affectedQuestionIds: duplicateConceptIds,
      });
    }

    // --- 2. Per-module diversity (40%) ---
    const perModuleMax = max * 0.4;
    const moduleConcepts: Record<number, { indices: Set<string>; qIds: string[] }> = {};
    for (const a of assignments) {
      const m = a.slot.moduleNumber;
      if (!moduleConcepts[m]) moduleConcepts[m] = { indices: new Set(), qIds: [] };
      if (a.question.teachingIndex) moduleConcepts[m].indices.add(a.question.teachingIndex);
      moduleConcepts[m].qIds.push(a.question.id);
    }

    const moduleKeys = Object.keys(moduleConcepts).map(Number);
    let moduleDupPenalty = 0;
    for (const m of moduleKeys) {
      const qsWithIndex = assignments.filter((a) => a.slot.moduleNumber === m && a.question.teachingIndex !== null);
      if (qsWithIndex.length <= 1) continue;

      const uniqInModule = moduleConcepts[m].indices.size;
      const dupInModule = qsWithIndex.length - uniqInModule;
      if (dupInModule > 0) {
        moduleDupPenalty += dupInModule / qsWithIndex.length;
        const modDupIds: string[] = [];
        const seen: Record<string, string[]> = {};
        for (const a of qsWithIndex) {
          const idx = a.question.teachingIndex!;
          if (!seen[idx]) seen[idx] = [];
          seen[idx].push(a.question.id);
        }
        for (const ids of Object.values(seen)) {
          if (ids.length > 1) modDupIds.push(...ids);
        }
        explanations.push({
          message: `Module ${m} has ${dupInModule} duplicate concept(s)`,
          affectedQuestionIds: modDupIds,
        });
      }
    }

    const avgModulePenalty = moduleKeys.length > 0 ? moduleDupPenalty / moduleKeys.length : 0;
    const moduleScore = perModuleMax * (1 - avgModulePenalty);

    const earned = Math.round((overallScore + moduleScore) * 100) / 100;
    return { label: "Concept Diversity", earned, max, explanations };
  }

  /* ─── Freshness ─────────────────────────────── */

  private scoreFreshness(assignments: SlotAssignment[]): CriterionDetail {
    const max = this.profile.weights.freshness;
    const explanations: CriterionExplanation[] = [];
    if (assignments.length === 0) return { label: "Freshness", earned: 0, max, explanations };

    const usedIds = new Set(this.usageHistory.map((u) => u.questionId));
    const staleIds: string[] = [];
    for (const a of assignments) {
      if (usedIds.has(a.question.id)) staleIds.push(a.question.id);
    }

    const avgPenalty = staleIds.length / assignments.length;
    const earned = Math.round(max * (1 - avgPenalty) * 100) / 100;

    if (staleIds.length > 0) {
      explanations.push({
        message: `${staleIds.length} question(s) used in previous exams`,
        affectedQuestionIds: staleIds,
      });
    }

    return { label: "Freshness", earned, max, explanations };
  }

  /* ─── Module Balance ────────────────────────── */

  private scoreModuleBalance(assignments: SlotAssignment[]): CriterionDetail {
    const max = this.profile.weights.moduleBalance;
    const explanations: CriterionExplanation[] = [];
    if (assignments.length === 0) return { label: "Module Balance", earned: 0, max, explanations };

    const moduleDiffs: Record<number, { values: number[]; qIds: string[] }> = {};
    for (const a of assignments) {
      const m = a.slot.moduleNumber;
      if (!moduleDiffs[m]) moduleDiffs[m] = { values: [], qIds: [] };
      moduleDiffs[m].values.push(DIFFICULTY_VALUE[a.question.difficultyLevel ?? "MEDIUM"]);
      moduleDiffs[m].qIds.push(a.question.id);
    }

    const moduleAvgs = Object.values(moduleDiffs).map((d) => d.values.reduce((s, v) => s + v, 0) / d.values.length);
    if (moduleAvgs.length <= 1) return { label: "Module Balance", earned: max, max, explanations };

    const mean = moduleAvgs.reduce((s, a) => s + a, 0) / moduleAvgs.length;
    const variance = moduleAvgs.reduce((s, a) => s + (a - mean) ** 2, 0) / moduleAvgs.length;
    const earned = Math.round(max * (1 - Math.min(1, variance)) * 100) / 100;

    if (variance > 0.1) {
      const modEntries = Object.entries(moduleDiffs).map(([m, d]) => ({
        module: Number(m),
        avg: d.values.reduce((s, v) => s + v, 0) / d.values.length,
        qIds: d.qIds,
      }));
      const outliers = modEntries.filter((m) => Math.abs(m.avg - mean) > 0.3);
      for (const o of outliers) {
        explanations.push({
          message: `Module ${o.module} difficulty (${o.avg.toFixed(2)}) deviates from mean (${mean.toFixed(2)})`,
          affectedQuestionIds: o.qIds,
        });
      }
    }

    return { label: "Module Balance", earned, max, explanations };
  }

  /* ─── Estimated Solve Time ──────────────────── */

  private scoreEstimatedSolveTime(assignments: SlotAssignment[]): CriterionDetail {
    const max = this.profile.weights.estimatedSolveTime;
    const explanations: CriterionExplanation[] = [];
    if (assignments.length === 0) return { label: "Estimated Solve Time", earned: max, max, explanations };

    const marksTimeMap = this.profile.solveTime.marksTimeMap;
    const estimated = assignments.reduce((sum, a) => sum + (marksTimeMap[a.question.marks] ?? 5), 0);
    const target = this.profile.solveTime.targetDurationMinutes;
    const diff = Math.abs(estimated - target);
    const ratio = diff / target;
    const earned = Math.round(Math.max(0, max - ratio * max) * 100) / 100;

    explanations.push({
      message: `Estimated ${estimated} min vs target ${target} min (${ratio > 0.1 ? `${(ratio * 100).toFixed(0)}% off` : "on target"})`,
      affectedQuestionIds: assignments.map((a) => a.question.id),
    });

    return { label: "Estimated Solve Time", earned, max, explanations };
  }
}
