import { createHash } from "crypto";
import type { RawBankData, EvidenceSnapshotData, DistributionData, MetricResult } from "./types";
import { EXTRACTION_ATTRIBUTES, STRUCTURAL_ELEMENTS, attributeStatus } from "./metric-engine";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

export class SnapshotBuilder {
  /**
   * Builds the EvidenceSnapshot from deterministic data.
   * This is the EXACT data package sent to Ollama — never raw question bank data.
   */
  build(data: RawBankData, metrics: MetricResult[]): EvidenceSnapshotData {
    const metricValues: Record<string, number | null> = {};
    for (const m of metrics) {
      metricValues[m.indexCode] = m.value;
    }

    const questions = structuredClone(data.questions).map(q => ({
      ...q,
      attributeStatuses: Object.fromEntries(EXTRACTION_ATTRIBUTES.map(a => [a, attributeStatus(q, a)])),
    }));
    const statuses = questions.map(q => {
      const values = Object.values(q.attributeStatuses);
      if (values.includes("MISSING_DATA")) return "MISSING_DATA";
      if (values.includes("UNABLE_TO_VERIFY")) return "UNABLE_TO_VERIFY";
      if (values.includes("PARTIALLY_VERIFIED")) return "PARTIALLY_VERIFIED";
      return "VERIFIED";
    });
    return {
      questionBankId: data.questionBankId,
      questions,
      totalMarks: data.totalMarks,
      structuralChecks: structuredClone(data.structuralChecks),
      structuralElements: STRUCTURAL_ELEMENTS.map(element => ({ element, present: data.structuralChecks?.[element] ?? null })),
      documentedCourseOutcomes: structuredClone(data.documentedCourseOutcomes),
      academicEvidence: structuredClone(data.academicEvidence),
      indexConfidence: structuredClone(data.indexConfidence),
      expectedBloomDistribution: structuredClone(data.expectedBloomDistribution),
      expectedDifficultyDistribution: structuredClone(data.expectedDifficultyDistribution),
      metricConfidence: Object.fromEntries(metrics.map(m => [m.indexCode, m.confidenceScore ?? null])),
      partiallyVerifiedQuestions: statuses.filter(s => s === "PARTIALLY_VERIFIED").length,
      totalQuestions: data.questions.length,
      verifiedQuestions: statuses.filter(s => s === "VERIFIED").length,
      unableToVerifyQuestions: statuses.filter(s => s === "UNABLE_TO_VERIFY").length,
      missingDataQuestions: statuses.filter(s => s === "MISSING_DATA").length,
      extractionCompletenessScore: metricValues["ECS"] ?? null,
      extractionQualityIndex: metricValues["EQI"] ?? null,
      metrics: metricValues,
      distributions: this.buildDistributions(data),
      detectedRisks: this.detectRisks(metrics),
      outlierLists: [],
      supportingEvidence: {},
      representativeExamples: {},
    };
  }

  /**
   * Computes the EvidenceHash: SHA-256 of (snapshot JSON + engine version + prompt version).
   * This is the cache key — if unchanged, skip Ollama.
   */
  computeEvidenceHash(
    snapshot: EvidenceSnapshotData,
    evaluationEngineVersion: string,
    promptVersion: string,
  ): string {
    const input = JSON.stringify(canonicalize({ snapshot, evaluationEngineVersion, promptVersion }));
    return createHash("sha256").update(input, "utf-8").digest("hex");
  }

  private buildDistributions(data: RawBankData): DistributionData {
    const bloom: Record<string, number> = {};
    const difficulty: Record<string, number> = {};
    const coCoverage: Record<string, number> = {};
    const moduleCoverage: Record<string, number> = {};
    const marksDistribution: Record<string, number> = {};
    const questionTypeDistribution: Record<string, number> = {};
    const questionStatusDistribution: Record<string, number> = {};
    const moduleMarks: Record<string, number> = {};

    for (const q of data.questions) {
      if (q.rbtLevel) bloom[q.rbtLevel] = (bloom[q.rbtLevel] ?? 0) + 1;
      if (q.difficultyLevel) difficulty[q.difficultyLevel] = (difficulty[q.difficultyLevel] ?? 0) + 1;
      if (q.coMapping) coCoverage[q.coMapping] = (coCoverage[q.coMapping] ?? 0) + 1;
      const modKey = `Module ${q.moduleNumber}`;
      moduleCoverage[modKey] = (moduleCoverage[modKey] ?? 0) + 1;
      const markKey = String(q.marks);
      marksDistribution[markKey] = (marksDistribution[markKey] ?? 0) + 1;
      if (q.questionType) questionTypeDistribution[q.questionType] = (questionTypeDistribution[q.questionType] ?? 0) + 1;
      questionStatusDistribution[q.questionStatus ?? "unknown"] = (questionStatusDistribution[q.questionStatus ?? "unknown"] ?? 0) + 1;
      moduleMarks[modKey] = (moduleMarks[modKey] ?? 0) + q.marks;
    }

    return { bloom, difficulty, coCoverage, moduleCoverage, marksDistribution, questionTypeDistribution, questionStatusDistribution, moduleMarks };
  }

  private detectRisks(metrics: MetricResult[]): string[] {
    const risks: string[] = [];
    for (const m of metrics) {
      if (m.value === null) risks.push(`${m.indexCode}: unable to compute`);
      else if (m.value < 0.5) risks.push(`${m.indexCode}: ${m.classification} (${m.value.toFixed(2)})`);
    }
    return risks;
  }
}
