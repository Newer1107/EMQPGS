import { IndexCode, Classification, ConfidenceClassification, AnalysisStatus, FinalVerdict } from "@prisma/client";
import { z } from "zod";

// ── Branded Types ──────────────────────────────
export type QuestionBankId = string & { readonly __brand: "QuestionBankId" };
export type AnalysisVersionTag = string & { readonly __brand: "AnalysisVersionTag" };

// ── Pipeline Stage Identifiers ────────────────
export enum PipelineStage {
  EVIDENCE_BUILDER = "evidence-builder",
  METRIC_ENGINE = "metric-engine",
  SNAPSHOT_BUILDER = "snapshot-builder",
  PROMPT_BUILDER = "prompt-builder",
  OLLAMA_SERVICE = "ollama-service",
  RESPONSE_VALIDATOR = "response-validator",
  ANALYSIS_BUILDER = "analysis-builder",
  PERSISTENCE = "persistence",
}

// ── Raw Bank Data (what EvidenceBuilder produces) ──
export interface RawBankData {
  questionBankId: string;
  subjectName: string;
  subjectCode: string;
  totalSlots: number;
  filledSlots: number;
  questions: ExtractedQuestionData[];
  modules: ModuleSummary[];
  totalMarks: number;
  marksOptions: number[];
  extractionTimestamp: string;
}

export interface ExtractedQuestionData {
  questionIndex: number;
  questionText: string;
  marks: number;
  moduleNumber: number;
  coMapping: string | null;
  rbtLevel: string | null;
  difficultyLevel: string | null;
  questionType: string | null;
  commandVerb: string | null;
  coStatus: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNABLE_TO_VERIFY" | "MISSING_DATA";
  rbtStatus: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNABLE_TO_VERIFY" | "MISSING_DATA";
  difficultyStatus: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNABLE_TO_VERIFY" | "MISSING_DATA";
  questionStatus: string | null;
  clarityScore: number;
}

export interface ModuleSummary {
  moduleNumber: number;
  totalQuestions: number;
  totalMarks: number;
  coveredCOs: string[];
}

// ── EvidenceSnapshot (what SnapshotBuilder produces) ──
export interface EvidenceSnapshotData {
  totalQuestions: number;
  verifiedQuestions: number;
  unableToVerifyQuestions: number;
  missingDataQuestions: number;
  extractionCompletenessScore: number | null;
  extractionQualityIndex: number | null;
  metrics: Record<string, number | null>;
  distributions: DistributionData;
  detectedRisks: string[];
  outlierLists: string[];
  supportingEvidence: Record<string, string[]>;
  representativeExamples: Record<string, string>;
}

export interface DistributionData {
  bloom: Record<string, number>;
  difficulty: Record<string, number>;
  coCoverage: Record<string, number>;
  moduleCoverage: Record<string, number>;
  marksDistribution: Record<string, number>;
  questionTypeDistribution: Record<string, number>;
  questionStatusDistribution: Record<string, number>;
  moduleMarks: Record<string, number>;
}

// ── Structured AI Prompts ──
export interface StructuredPrompts {
  modules: ModulePrompt[];
  totalEstimatedTokens: number;
}

export interface ModulePrompt {
  moduleId: string;
  promptText: string;
  promptVersionId: string;
  contextBudget: number;
  outputSchema: Record<string, unknown>;
}

// ── AI Response Types ──
export interface AIRawResponse {
  rawText: string;
  model: string;
  durationMs: number;
}

export interface ValidatedAIResponse {
  modules: ValidatedModuleOutput[];
  overallValid: boolean;
}

export interface ValidatedModuleOutput {
  moduleId: string;
  success: boolean;
  data: Record<string, unknown> | null;
  validationErrors: string[];
  retryCount: number;
}

// ── Analysis Snapshot ──
export interface AnalysisSnapshotResult {
  analysisVersionId: string;
  status: string;
  metrics: Array<{
    indexCode: IndexCode;
    value: number | null;
    classification: Classification | null;
    weight: number | null;
    weightedScore: number | null;
  }>;
  executiveSummary: string | null;
  finalVerdict: FinalVerdict | null;
  risks: Array<{
    finding: string;
    priority: string;
    riskType: string | null;
  }>;
  recommendations: Array<{
    finding: string;
    recommendation: string;
    priority: string;
  }>;
  strengths: Array<{ id: string; strength: string }>;
  weaknesses: Array<{ id: string; weakness: string }>;
  aiModules: ValidatedModuleOutput[];
  evidenceHash: string | null;
}

// ── Metric Result (what MetricEngine produces) ──
export interface MetricResult {
  indexCode: string;
  value: number | null;
  classification: string | null;
}

// ── Zod Schema for evidence hash ──
export const evidenceSchema = z.object({
  snapshot: z.record(z.string(), z.unknown()),
  engineVersion: z.string(),
  promptVersion: z.string(),
});

// ── Comparison Types ──
export interface ComparisonResult {
  versionA: { versionNumber: number; createdAt: Date };
  versionB: { versionNumber: number; createdAt: Date };
  deltas: MetricDelta[];
}

export interface MetricDelta {
  indexCode: string;
  oldValue: number | null;
  newValue: number | null;
  delta: number | null;
  direction: "improved" | "declined" | "unchanged";
}

// ── Pipeline Stage Options ──
export interface PipelineOptions {
  evidenceBuilder?: boolean;
  metricEngine?: boolean;
  snapshotBuilder?: boolean;
  promptBuilder?: boolean;
  ollamaService?: boolean;
  responseValidator?: boolean;
  analysisBuilder?: boolean;
  persistence?: boolean;
  forceRegenerate?: boolean; // skip hash check
}
