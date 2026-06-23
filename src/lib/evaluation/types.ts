// ── Question Bank Evaluation Types ────────────────────────────────
// Coordinator's academic quality evaluation before moderation/approval.
// All metrics are deterministic; AI only explains.

export const EVALUATION_ENGINE_VERSION = "eval-1.0.0";
export const EVALUATION_SCHEMA_VERSION = "1.0.0";

// ── Raw Bank Snapshot ─────────────────────────────────────────────

export interface EvaluationBankData {
  questionBankId: string;
  subjectName: string;
  subjectCode: string;
  batchName: string;
  semesterNumber: number;
  academicYearCode: string;
  departmentName: string;
  totalSlots: number;
  filledSlots: number;
  questions: EvaluationQuestion[];
  modules: number[];
  marksOptions: number[];
}

export interface EvaluationQuestion {
  slotId: string;
  moduleNumber: number;
  marks: number;
  slotNumber: number;
  questionText: string | null;
  coMapping: string | null;
  rbtLevel: string | null;
  difficultyLevel: string | null;
  questionStatus: string | null;
  isLocked: boolean;
}

// ── Module Summary ────────────────────────────────────────────────

export interface ModuleSummaryRow {
  moduleNumber: number;
  moduleName: string;
  totalSlots: number;
  filledSlots: number;
  totalMarks: number;
  category: "Theory" | "Problem-solving" | "Application";
  articulation: string; // e.g. "CO1, CO2, CO3"
}

// ── Attribute Completeness ────────────────────────────────────────

export interface ModuleAttributeCompleteness {
  moduleNumber: number;
  totalQuestions: number;
  metadataComplete: number;
  missingRbt: number;
  missingCo: number;
  missingDifficulty: number;
  missingMarks: number;
  completenessPct: number;
}

// ── RBT Distribution ──────────────────────────────────────────────

export interface RbtDistribution {
  remember: number;
  understand: number;
  apply: number;
  analyze: number;
  evaluate: number;
  create: number;
}

export interface ModuleRbtDistribution {
  moduleNumber: number;
  distribution: RbtDistribution;
  total: number;
}

// ── Difficulty Distribution ───────────────────────────────────────

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface ModuleDifficultyDistribution {
  moduleNumber: number;
  distribution: DifficultyDistribution;
  total: number;
}

// ── Marks Distribution ────────────────────────────────────────────

export interface MarksDistribution {
  [marks: number]: number; // marks → count
}

export interface ModuleMarksDistribution {
  moduleNumber: number;
  distribution: MarksDistribution;
  total: number;
}

// ── CO-PO-PI Coverage ─────────────────────────────────────────────

export interface CoCoverage {
  co: string;
  totalQuestions: number;
  modules: number[];
  coveragePct: number; // % of modules that cover this CO
}

// ── Constructive Alignment ────────────────────────────────────────

export interface AlignmentSummary {
  score: number; // 0-1
  risks: string[];
  recommendations: string[];
}

// ── Quality Metrics ───────────────────────────────────────────────

export interface ModuleQualityMetric {
  moduleNumber: number;
  clarity: number; // 0-1
  relevance: number; // 0-1
  rbtAccuracy: number; // 0-1
  poPiCoverage: number; // 0-1
  remarks: string;
}

// ── Final Assessment ──────────────────────────────────────────────

export interface ModuleFinalAssessment {
  moduleNumber: number;
  rating: "Highly Effective" | "Effective" | "Acceptable" | "Needs Improvement" | "Major Revision";
  threshold: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

// ── Consolidated Scores ───────────────────────────────────────────

export interface ConsolidatedModuleScore {
  moduleNumber: number;
  clarity: number;
  relevance: number;
  rbtAccuracy: number;
  completeness: number;
  average: number;
  overallScore: number;
}

// ── Final Verdict ─────────────────────────────────────────────────

export type FinalVerdictLevel = "Highly Effective" | "Moderately Effective" | "Needs Revision";

export interface EvaluationVerdict {
  verdict: FinalVerdictLevel;
  overallScore: number;
  thresholds: { highlyEffective: number; moderatelyEffective: number; needsRevision: number };
}

// ── Question-Level Findings ───────────────────────────────────────

export interface QuestionFinding {
  slotId: string;
  moduleNumber: number;
  marks: number;
  currentRbt: string | null;
  difficulty: string | null;
  co: string | null;
  problem: string;
  pedagogicalConsequence: string;
  recommendation: string;
  confidence: number; // 0-100
}

// ── Complete Evaluation Report (stored in AnalysisSnapshot.fullReport) ──

export interface EvaluationReport {
  // Section 1: Objective
  objective: {
    subjectName: string;
    subjectCode: string;
    batchName: string;
    semesterNumber: number;
    academicYear: string;
    departmentName: string;
    totalQuestions: number;
    evaluationDate: string;
    narrative: string;
  };

  // Section 2: Module Summary
  moduleSummary: ModuleSummaryRow[];
  moduleSummaryAiNarrative: string;

  // Section 3: Attribute Completeness
  attributeCompleteness: ModuleAttributeCompleteness[];
  overallCompletenessPct: number;
  attributeAiNarrative: string;

  // Section 4: RBT Distribution
  overallRbt: RbtDistribution;
  moduleRbt: ModuleRbtDistribution[];
  idealDistribution: RbtDistribution;
  rbtAiNarrative: string;

  // Section 5: Difficulty Distribution
  overallDifficulty: DifficultyDistribution;
  moduleDifficulty: ModuleDifficultyDistribution[];
  difficultyAiNarrative: string;

  // Section 6: Marks Distribution
  overallMarks: MarksDistribution;
  moduleMarks: ModuleMarksDistribution[];
  marksAiNarrative: string;

  // Section 7: CO Coverage
  coCoverage: CoCoverage[];
  coCoverageAiNarrative: string;

  // Section 8: Constructive Alignment
  alignmentSummary: AlignmentSummary;
  alignmentAiNarrative: string;

  // Section 9: Quality Metrics
  qualityMetrics: ModuleQualityMetric[];
  qualityAiNarrative: string;

  // Section 10: Final Assessment
  finalAssessments: ModuleFinalAssessment[];
  finalAssessmentAiNarrative: string;

  // Section 11: Consolidated Scores
  consolidatedScores: ConsolidatedModuleScore[];
  overallAverage: number;

  // Section 12: Final Verdict
  verdict: EvaluationVerdict;
  verdictAiNarrative: string;

  // Question-Level Findings
  questionFindings: QuestionFinding[];
  findingsAiNarrative: string;

  // Metadata
  engineVersion: string;
  promptVersion: string;
  generationDurationMs: number;
}

// ── Deterministic-only output (before AI) ─────────────────────────

export interface DeterministicEvaluation {
  moduleSummary: ModuleSummaryRow[];
  attributeCompleteness: ModuleAttributeCompleteness[];
  overallCompletenessPct: number;
  overallRbt: RbtDistribution;
  moduleRbt: ModuleRbtDistribution[];
  idealDistribution: RbtDistribution;
  overallDifficulty: DifficultyDistribution;
  moduleDifficulty: ModuleDifficultyDistribution[];
  overallMarks: MarksDistribution;
  moduleMarks: ModuleMarksDistribution[];
  coCoverage: CoCoverage[];
  alignmentScore: number;
  qualityMetrics: ModuleQualityMetric[];
  consolidatedScores: ConsolidatedModuleScore[];
  overallAverage: number;
  verdict: EvaluationVerdict;
  questionFindings: QuestionFinding[];
}

// ── Evidence snapshot sent to AI ──────────────────────────────────

export interface EvaluationEvidence {
  totalQuestions: number;
  totalModules: number;
  totalMarks: number;
  moduleSummaries: ModuleSummaryRow[];
  completenessPerModule: ModuleAttributeCompleteness[];
  overallCompleteness: number;
  rbtDistribution: RbtDistribution;
  moduleRbt: ModuleRbtDistribution[];
  difficultyDistribution: DifficultyDistribution;
  marksDistribution: MarksDistribution;
  coCoverage: CoCoverage[];
  alignmentScore: number;
  qualityMetrics: ModuleQualityMetric[];
  questionFindings: QuestionFinding[];
  consolidatedScores: ConsolidatedModuleScore[];
  overallAverage: number;
  verdict: EvaluationVerdict;
}
