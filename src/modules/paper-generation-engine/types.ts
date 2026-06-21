import type { DifficultyLevel, RbtLevel, QuestionLibraryItem } from "@prisma/client";

/** A single slot position in the paper that must be filled. */
export type PaperSlot = {
  moduleNumber: number;
  marks: number;
  slotNumber: number;
};

/** A tentative assignment of a question to a slot within a partial paper. */
export type SlotAssignment = {
  slot: PaperSlot;
  question: QuestionLibraryItem;
};

/** The final output of a paper generation run. */
export type PaperSolution = {
  variant: string;
  assignments: SlotAssignment[];
  report: EvaluationReport;
};

/** Per-category score with a human-readable explanation. */
export type ScoreCategory = {
  label: string;
  earned: number;
  max: number;
  deductions: string[];
};

/** Full evaluation breakdown for a paper. */
export type EvaluationReport = {
  overall: number;
  categories: ScoreCategory[];
  summary: string;
};

/** Weights used by the evaluation engine. Must sum to 100. */
export type EvaluationWeights = {
  difficultyBalance: number;
  bloomBalance: number;
  conceptDiversity: number;
  freshness: number;
  moduleBalance: number;
  estimatedSolveTime: number;
};

/** Default weights summing to 100. */
export const DEFAULT_WEIGHTS: EvaluationWeights = {
  difficultyBalance: 30,
  bloomBalance: 20,
  conceptDiversity: 20,
  freshness: 15,
  moduleBalance: 10,
  estimatedSolveTime: 5,
};

/** Numeric mapping of difficulty levels for scoring. */
export const DIFFICULTY_VALUE: Record<DifficultyLevel, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

/** Target difficulty for balance calculation (prefer MEDIUM). */
export const TARGET_DIFFICULTY = 2;

/** All recognised Bloom's levels. */
export const BLOOM_LEVELS: RbtLevel[] = ["L1", "L2", "L3", "L4", "L5", "L6"];

/** Marks values used in the paper pattern. */
export const MARKS_PATTERN = [2, 5, 10] as const;

/* ─── Evaluation Profile ─────────────────────── */

/** Data-driven evaluation profile. Add new profiles without code changes. */
export type EvaluationProfile = {
  id: string;
  name: string;
  description: string;
  weights: EvaluationWeights;
  /** Difficulty tuning. targetValue at 2.0 = MEDIUM. */
  difficulty: {
    targetValue: number;
    /** Weight (0-1) for per-module difficulty variance penalty. */
    perModuleWeight: number;
    /** Weight (0-1) for difficulty progression penalty. */
    progressionWeight: number;
  };
  /** Bloom tuning. */
  bloom: {
    /** Target distribution across levels. Keys are RbtLevel values. Sum to 1. */
    targetDistribution: Partial<Record<string, number>>;
    perModuleWeight: number;
    progressionWeight: number;
  };
  /** Solve time tuning. */
  solveTime: {
    targetDurationMinutes: number;
    /** Estimated minutes per mark value. */
    marksTimeMap: Record<number, number>;
  };
};

export const DEFAULT_TCET_PROFILE: EvaluationProfile = {
  id: "tcet-default",
  name: "TCET Standard",
  description: "Standard TCET evaluation profile with balanced criteria weights.",
  weights: {
    difficultyBalance: 30,
    bloomBalance: 20,
    conceptDiversity: 20,
    freshness: 15,
    moduleBalance: 10,
    estimatedSolveTime: 5,
  },
  difficulty: { targetValue: 2, perModuleWeight: 0.35, progressionWeight: 0.15 },
  bloom: {
    targetDistribution: { L1: 0.17, L2: 0.17, L3: 0.17, L4: 0.17, L5: 0.16, L6: 0.16 },
    perModuleWeight: 0.3,
    progressionWeight: 0.2,
  },
  solveTime: { targetDurationMinutes: 180, marksTimeMap: { 2: 2, 5: 8, 10: 15 } },
};

export const ISE_PROFILE: EvaluationProfile = {
  ...DEFAULT_TCET_PROFILE,
  id: "tcet-ise",
  name: "TCET ISE",
  description: "TCET profile for in-semester examinations (60 min).",
  solveTime: { targetDurationMinutes: 60, marksTimeMap: { 2: 2, 5: 8 } },
};

/* ─── Generation Trace ───────────────────────── */

/** A single candidate that was evaluated but may have been rejected. */
export type CandidateEvaluation = {
  questionId: string;
  score: number;
  report: EvaluationReport;
  selected: boolean;
  rejectionReasons: string[];
};

/** Decision for one slot during generation. */
export type SlotDecision = {
  moduleNumber: number;
  marks: number;
  candidates: CandidateEvaluation[];
  selectedQuestionId: string;
};

/** Strategy-level statistics. */
export type GenerationStats = {
  strategyName: string;
  profileId: string;
  generatedAt: string;
  durationMs: number;
  totalCandidatesConsidered: number;
  candidatesRejectedByConstraints: number;
  candidatesEvaluated: number;
  constraintFailuresByType: Record<string, number>;
};

/** Full trace of the generation process for explainability. */
export type GenerationTrace = {
  stats: GenerationStats;
  slotDecisions: SlotDecision[];
  finalReport: EvaluationReport;
};

/** Score report detail linking criterion reason to affected question IDs. */
export type CriterionDetail = {
  label: string;
  earned: number;
  max: number;
  explanations: CriterionExplanation[];
};

export type CriterionExplanation = {
  message: string;
  affectedQuestionIds: string[];
};

/** Enhanced evaluation report with per-criterion explanations. */
export type DetailedEvaluationReport = EvaluationReport & {
  details: CriterionDetail[];
};
