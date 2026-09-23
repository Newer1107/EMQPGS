import { IndexCode } from "@prisma/client";
import { classifyIndex, classifyConfidence, computeConfidence } from "./classification-matrix";
import type { RawBankData, ExtractedQuestionData, ExtractionAttribute, ExtractionStatus, StructuralElement } from "./types";

export interface MetricResult {
  indexCode: IndexCode;
  value: number | null;
  classification: ReturnType<typeof classifyIndex>;
  confidenceScore?: number | null;
  confidenceClassification?: ReturnType<typeof classifyConfidence>;
  weight: number | null;
  computationOrder: number;
  formulaUsed: string;
}

export const EXTRACTION_ATTRIBUTES: ExtractionAttribute[] = [
  "questionId", "questionText", "marks", "coMapping", "poMapping", "piMapping",
  "rbtLevel", "difficultyLevel", "questionType",
];
export const STRUCTURAL_ELEMENTS: StructuralElement[] = [
  "courseInformation", "questionNumbering", "marksAllocation", "coMapping",
  "bloomMapping", "difficultyMapping", "sectionLabels", "assessmentInstructions",
  "metadataConsistency", "questionFormatting",
];
const CORE_WEIGHTS: Record<string, number> = {
  SCI: .10, MII: .10, BDI: .15, CVI: .10, MCAI: .10,
  DBI: .10, QCQI: .15, CAI: .10, AMI: .05, FRI: .05,
};
const SUB_CODES = ["COA", "POA", "PIA", "RBTA", "DA", "MAA", "QTA", "MC", "MCS"];
const ORDER = ["ECS", "EQI", ...SUB_CODES, "LOTS", "HOTS", "CBR", "SCI", "MII",
  "BDI", "CVI", "MCAI", "DBI", "QCQI", "CAI", "AMI", "FRI", "QPQI", "OCI"];

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function result(code: string, value: number | null, formulaUsed: string): MetricResult {
  const score = validScore(value) ? value : null;
  return { indexCode: code as IndexCode, value: score,
    classification: code === "OCI" ? null : classifyIndex(score),
    weight: CORE_WEIGHTS[code] ?? (SUB_CODES.includes(code) ? 1 / 9 : null),
    computationOrder: ORDER.indexOf(code) + 1, formulaUsed };
}

export function attributePresent(q: ExtractedQuestionData, attribute: ExtractionAttribute): boolean {
  // The generated display index is not a source question identifier.
  const value = attribute === "questionId" ? q.sourceQuestionId : q[attribute];
  return attribute === "marks"
    ? typeof value === "number" && Number.isFinite(value) && value > 0
    : typeof value === "string" && value.trim().length > 0;
}
export function attributeStatus(q: ExtractedQuestionData, attribute: ExtractionAttribute): ExtractionStatus {
  if (!attributePresent(q, attribute)) return "MISSING_DATA";
  const explicit = q.attributeStatuses?.[attribute];
  if (explicit) return explicit;
  switch (attribute) {
    case "coMapping": return q.coStatus;
    case "poMapping": return q.poStatus ?? "UNABLE_TO_VERIFY";
    case "piMapping": return q.piStatus ?? "UNABLE_TO_VERIFY";
    case "rbtLevel": return q.rbtStatus;
    case "difficultyLevel": return q.difficultyStatus;
    case "questionType": return q.questionTypeStatus ?? "UNABLE_TO_VERIFY";
    default: return "UNABLE_TO_VERIFY";
  }
}
export function computeECS(data: RawBankData): MetricResult {
  const extracted = data.questions.reduce((sum, q) => sum +
    EXTRACTION_ATTRIBUTES.filter(a => attributePresent(q, a)).length, 0);
  return result("ECS", data.questions.length ? extracted / (data.questions.length * 9) : null,
    "extracted_attributes / required_attributes (9 per question)");
}
export function computeEQI(data: RawBankData): MetricResult {
  let extracted = 0, verified = 0;
  for (const q of data.questions) for (const a of EXTRACTION_ATTRIBUTES) {
    if (attributePresent(q, a)) {
      extracted++;
      if (attributeStatus(q, a) === "VERIFIED") verified++;
    }
  }
  return result("EQI", extracted ? verified / extracted : null, "verified_attributes / extracted_attributes");
}
function accuracy(data: RawBankData, code: string, attribute: ExtractionAttribute): MetricResult {
  const questions = data.questions;
  // Missing or unreviewed attributes do not establish incorrectness.
  const verdicts = questions.map(q => {
    if (!attributePresent(q, attribute)) return null;
    const explicit = q.attributeAccuracy?.[attribute];
    if (typeof explicit === "boolean") return explicit;
    // Marks extraction only verifies transcription, not allocation correctness.
    return attribute !== "marks" && attributeStatus(q, attribute) === "VERIFIED" ? true : null;
  });
  const complete = verdicts.length > 0 && verdicts.every(v => typeof v === "boolean");
  return result(code, complete ? verdicts.filter(Boolean).length / verdicts.length : null,
    "reviewed_correct_attributes / total_attributes; requires complete review");
}
export const computeCOA = (d: RawBankData) => accuracy(d, "COA", "coMapping");
export const computePOA = (d: RawBankData) => accuracy(d, "POA", "poMapping");
export const computePIA = (d: RawBankData) => accuracy(d, "PIA", "piMapping");
export const computeRBTA = (d: RawBankData) => accuracy(d, "RBTA", "rbtLevel");
export const computeDA = (d: RawBankData) => accuracy(d, "DA", "difficultyLevel");
export const computeMAA = (d: RawBankData) => accuracy(d, "MAA", "marks");
export const computeQTA = (d: RawBankData) => accuracy(d, "QTA", "questionType");
export function computeMC(data: RawBankData): MetricResult {
  const fields = EXTRACTION_ATTRIBUTES.filter(a => a !== "questionId" && a !== "questionText");
  const count = data.questions.reduce((sum, q) => sum + fields.filter(a => attributePresent(q, a)).length, 0);
  return result("MC", data.questions.length ? count / (data.questions.length * fields.length) : null,
    "available_metadata_fields / required_metadata_fields (7 per question)");
}
function reviewed(data: RawBankData, code: "QCQI" | "AMI" | "FRI" | "CAI" | "MCS", criteria?: string[]): MetricResult {
  const evidence = data.academicEvidence?.[code];
  const complete = evidence && evidence.length > 0 &&
    data.questions.length > 0 &&
    evidence.every(e => validScore(e.score) && e.sourceIds.some(id => id.trim().length > 0)) &&
    (!(code === "AMI" || code === "FRI") || evidence.every(e => e.score === 0 || e.score === 1)) &&
    new Set(evidence.map(e => e.criterion)).size === evidence.length &&
    (!criteria || (evidence.length === criteria.length && criteria.every(c => evidence.some(e => e.criterion === c))));
  return result(code, complete ? evidence.reduce((sum, e) => sum + e.score!, 0) / evidence.length : null,
    "mean(documented_reviewed_criterion_scores); requires all criteria and source references");
}
export const computeMCS = (d: RawBankData) => reviewed(d, "MCS");
export const computeQCQI = (d: RawBankData) => reviewed(d, "QCQI",
  ["clarity", "precision", "technicalAccuracy", "context", "validity", "alignment", "fairness"]);
export const computeAMI = (d: RawBankData) => reviewed(d, "AMI",
  ["validity", "reliability", "fairness", "transparency", "traceability", "consistency", "governanceCompliance"]);
export const computeFRI = (d: RawBankData) => reviewed(d, "FRI",
  ["hotsIntegration", "industryRelevance", "employabilitySkills", "problemSolving", "innovation", "criticalThinking", "graduateAttributes"]);
export const computeCAI = (d: RawBankData) => reviewed(d, "CAI");

const BLOOM = ["L1", "L2", "L3", "L4", "L5", "L6"];
function completeBloom(data: RawBankData): boolean {
  return data.questions.length > 0 && data.questions.every(q => BLOOM.includes(q.rbtLevel ?? ""));
}
export function computeLOTS(data: RawBankData): MetricResult {
  return result("LOTS", completeBloom(data) ? data.questions.filter(q => BLOOM.slice(0, 3).includes(q.rbtLevel!)).length / data.questions.length : null,
    "lots_questions / total_questions");
}
export function computeHOTS(data: RawBankData): MetricResult {
  return result("HOTS", completeBloom(data) ? data.questions.filter(q => BLOOM.slice(3).includes(q.rbtLevel!)).length / data.questions.length : null,
    "hots_questions / total_questions");
}
export function computeCBR(_data: RawBankData, lots: MetricResult, hots: MetricResult): MetricResult {
  return result("CBR", lots.value !== null && lots.value > 0 && hots.value !== null
    ? Math.min(hots.value / lots.value, 1) : null, "min(hots / lots, 1)");
}
export function computeSCI(data: RawBankData): MetricResult {
  const checks = STRUCTURAL_ELEMENTS.map(key => data.structuralChecks?.[key]);
  return result("SCI", checks.every(v => typeof v === "boolean")
    ? checks.filter(Boolean).length / checks.length : null,
    "structural_elements_present / 10; requires all structural checks");
}
function composite(results: MetricResult[], code: string, weights: Record<string, number>): MetricResult {
  const values = Object.entries(weights).map(([key, weight]) => {
    const matches = results.filter(r => r.indexCode === key);
    return { value: matches.length === 1 ? matches[0].value : null, weight };
  });
  return result(code, values.every(v => validScore(v.value))
    ? values.reduce((sum, v) => sum + v.value! * v.weight, 0) : null,
    code === "MII" ? "(COA + POA + PIA + RBTA + DA + MAA + QTA + MC + MCS) / 9" : "Σ(index_value × fixed_weight); all 10 indices required");
}
export const computeMII = (r: MetricResult[]) => composite(r, "MII", Object.fromEntries(SUB_CODES.map(c => [c, 1 / 9])));
export const computeQPQI = (r: MetricResult[]) => composite(r, "QPQI", CORE_WEIGHTS);

function balance(data: RawBankData, code: string, field: "rbtLevel" | "difficultyLevel", expected: Record<string, number>, keys: string[]): MetricResult {
  const validPolicy = Object.keys(expected).length === keys.length && keys.every(k => validScore(expected[k])) &&
    Math.abs(Object.values(expected).reduce((s, n) => s + n, 0) - 1) < 1e-9;
  const complete = data.questions.length > 0 && data.questions.every(q => keys.includes(q[field] ?? ""));
  const value = validPolicy && complete ? 1 - keys.reduce((sum, key) =>
    sum + Math.abs(data.questions.filter(q => q[field] === key).length / data.questions.length - expected[key]), 0) / 2 : null;
  return result(code, value, "1 - Σ|Observed - Expected| / 2");
}
export const computeBDI = (d: RawBankData) => balance(d, "BDI", "rbtLevel",
  // Full Bloom engine specification §7.7 supplies this default.
  d.expectedBloomDistribution ?? { L1: .10, L2: .20, L3: .25, L4: .20, L5: .15, L6: .10 }, BLOOM);
export const computeDBI = (d: RawBankData) => balance(d, "DBI", "difficultyLevel",
  d.expectedDifficultyDistribution ?? { EASY: .3, MEDIUM: .5, HARD: .2 }, ["EASY", "MEDIUM", "HARD"]);
export function computeCVI(data: RawBankData): MetricResult {
  const outcomes = new Set(data.documentedCourseOutcomes?.map(s => s.trim()).filter(Boolean));
  const covered = new Set(data.questions.map(q => q.coMapping?.trim()).filter((co): co is string => !!co && outcomes.has(co)));
  return result("CVI", outcomes.size && data.questions.length ? covered.size / outcomes.size : null,
    "covered_documented_course_outcomes / total_documented_course_outcomes");
}
export function computeMCAI(data: RawBankData): MetricResult {
  const complete = completeBloom(data) && data.questions.every(q => Number.isFinite(q.marks) && q.marks > 0);
  const aligned = data.questions.filter(q => {
    const level = BLOOM.indexOf(q.rbtLevel ?? "") + 1;
    if (q.marks <= 2) return level === 1 || level === 2;
    if (q.marks <= 5) return level === 2 || level === 3;
    if (q.marks <= 8) return level === 3 || level === 4;
    if (q.marks <= 12) return level === 4 || level === 5;
    return level === 5 || level === 6;
  }).length;
  return result("MCAI", complete ? aligned / data.questions.length : null,
    "marks_bloom_aligned_questions / total_questions (framework §8.6)");
}
export function computeOCI(results: MetricResult[]): MetricResult {
  const scores = Object.keys(CORE_WEIGHTS).map(code => {
    const matches = results.filter(r => r.indexCode === code);
    return matches.length === 1 ? matches[0].confidenceScore : null;
  });
  const value = scores.every(validScore) ? scores.reduce<number>((sum, s) => sum + s!, 0) / 10 : null;
  return { ...result("OCI", value, "mean(confidence_scores_for_10_core_indices)"),
    confidenceScore: value, confidenceClassification: classifyConfidence(value) };
}
export class MetricEngine {
  computeAll(data: RawBankData): MetricResult[] {
    const results = [computeECS(data), computeEQI(data), computeCOA(data), computePOA(data),
      computePIA(data), computeRBTA(data), computeDA(data), computeMAA(data), computeQTA(data),
      computeMC(data), computeMCS(data), computeLOTS(data), computeHOTS(data)];
    results.push(computeCBR(data, results[11], results[12]), computeSCI(data), computeMII(results),
      computeBDI(data), computeCVI(data), computeMCAI(data), computeDBI(data),
      computeQCQI(data), computeCAI(data), computeAMI(data), computeFRI(data));
    for (const metric of results) {
      const evidence = data.indexConfidence?.[metric.indexCode];
      const confidence = evidence ? computeConfidence(evidence.verified, evidence.required).score : null;
      metric.confidenceScore = confidence;
      metric.confidenceClassification = classifyConfidence(confidence);
    }
    results.push(computeQPQI(results), computeOCI(results));
    return results;
  }
}
