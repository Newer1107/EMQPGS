import type {
  GenerationTrace,
  EvaluationReport,
  ScoreCategory,
  SlotDecision,
  CandidateEvaluation,
  GenerationStats,
} from "@/modules/paper-generation-engine/types";

export type {
  GenerationTrace,
  EvaluationReport,
  ScoreCategory,
  SlotDecision,
  CandidateEvaluation,
  GenerationStats,
};

export type InsightQuestion = {
  id: string;
  questionText: string;
  marks: number;
  moduleNumber: number;
  co: string;
  rbtLevel: string;
  difficultyLevel: string | null;
  teachingIndex: string | null;
};

export type InsightsApiResponse = {
  variant: string;
  qualityScore: number | null;
  coverageScore: number | null;
  difficultyScore: number | null;
  duplicateRisk: number | null;
  recommendation: string | null;
  generatedAt: string | null;
  createdAt: string;
  evaluationReport: EvaluationReport;
  scoreBreakdown: string;
  generationTrace: GenerationTrace | null;
  questions: InsightQuestion[];
};
