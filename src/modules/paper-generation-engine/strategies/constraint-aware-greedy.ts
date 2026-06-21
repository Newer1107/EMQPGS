import type { QuestionLibraryItem, QuestionUsageHistory } from "@prisma/client";
import type {
  PaperSlot,
  SlotAssignment,
  PaperSolution,
  CandidateEvaluation,
  SlotDecision,
  GenerationStats,
  GenerationTrace,
  EvaluationReport,
} from "../types";
import type { CandidateBuilder } from "../candidate-builder";
import type { EvaluationEngine } from "../evaluation-engine";
import type { ConstraintEngine } from "../constraint-engine";
import type { SearchStrategy } from "./types";

export class ConstraintAwareGreedyStrategy implements SearchStrategy {
  search(
    slots: PaperSlot[],
    builder: CandidateBuilder,
    evaluator: EvaluationEngine,
    constraints: ConstraintEngine,
    usageHistory: QuestionUsageHistory[],
    variant: string,
  ): { solution: PaperSolution; trace: GenerationTrace } {
    const startTime = Date.now();
    const assignments: SlotAssignment[] = [];
    const slotDecisions: SlotDecision[] = [];
    let totalConsidered = 0;
    let rejectedByConstraints = 0;
    let evaluated = 0;
    const failuresByType: Record<string, number> = {};

    for (const slot of slots) {
      const candidates = builder.candidatesFor(slot, assignments);
      if (candidates.length === 0) {
        throw new Error(
          `No eligible candidates for M${slot.moduleNumber} ${slot.marks}-mark slot`,
        );
      }

      const candidateEvaluations: CandidateEvaluation[] = [];
      let bestScore = -1;
      let bestCandidate: QuestionLibraryItem | null = null;
      let bestReport: EvaluationReport | null = null;

      for (const candidate of candidates) {
        totalConsidered++;
        const temp: SlotAssignment[] = [...assignments, { slot, question: candidate }];
        const report = evaluator.evaluate(temp);
        evaluated++;

        candidateEvaluations.push({
          questionId: candidate.id,
          score: report.overall,
          report,
          selected: false,
          rejectionReasons: [],
        });

        if (report.overall > bestScore) {
          bestScore = report.overall;
          bestCandidate = candidate;
          bestReport = report;
        }
      }

      for (const ce of candidateEvaluations) {
        if (ce.questionId === bestCandidate!.id) {
          ce.selected = true;
        } else {
          const reasons: string[] = [];
          for (let i = 0; i < bestReport!.categories.length; i++) {
            const bestCat = bestReport!.categories[i];
            const otherCat = ce.report.categories[i];
            const diff = Math.round((bestCat.earned - otherCat.earned) * 100) / 100;
            if (diff > 0) {
              reasons.push(`Lower ${bestCat.label} (-${diff} pts)`);
            }
          }
          ce.rejectionReasons = reasons;
        }
      }

      slotDecisions.push({
        moduleNumber: slot.moduleNumber,
        marks: slot.marks,
        candidates: candidateEvaluations,
        selectedQuestionId: bestCandidate!.id,
      });

      assignments.push({ slot, question: bestCandidate! });
    }

    const validation = constraints.validateAssignment(assignments, usageHistory);
    if (!validation.valid) {
      for (const v of validation.violations) {
        failuresByType[v.rule] = (failuresByType[v.rule] ?? 0) + 1;
      }
      rejectedByConstraints = validation.violations.length;
      const msgs = validation.violations.map((v) => v.message).join("; ");
      throw new Error(`Constraint violations: ${msgs}`);
    }

    const report = evaluator.evaluate(assignments);
    const durationMs = Date.now() - startTime;

    const stats: GenerationStats = {
      strategyName: "ConstraintAwareGreedyStrategy",
      profileId: "tcet-default",
      generatedAt: new Date().toISOString(),
      durationMs,
      totalCandidatesConsidered: totalConsidered,
      candidatesRejectedByConstraints: rejectedByConstraints,
      candidatesEvaluated: evaluated,
      constraintFailuresByType: failuresByType,
    };

    const trace: GenerationTrace = {
      stats,
      slotDecisions,
      finalReport: report,
    };

    return { solution: { variant, assignments, report }, trace };
  }
}
