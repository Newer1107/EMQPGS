import type { PaperSolution, PaperSlot, GenerationTrace } from "../types";
import type { CandidateBuilder } from "../candidate-builder";
import type { EvaluationEngine } from "../evaluation-engine";
import type { ConstraintEngine } from "../constraint-engine";
import type { QuestionUsageHistory } from "@prisma/client";

export interface SearchStrategy {
  search(
    slots: PaperSlot[],
    builder: CandidateBuilder,
    evaluator: EvaluationEngine,
    constraints: ConstraintEngine,
    usageHistory: QuestionUsageHistory[],
    variant: string,
  ): { solution: PaperSolution; trace: GenerationTrace };
}
