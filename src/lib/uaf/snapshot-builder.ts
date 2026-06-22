import { createHash } from "crypto";
import type { RawBankData, EvidenceSnapshotData, DistributionData, MetricResult } from "./types";

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

    return {
      totalQuestions: data.questions.length,
      verifiedQuestions: data.questions.filter(
        (q) => q.coStatus === "VERIFIED" || q.rbtStatus === "VERIFIED",
      ).length,
      unableToVerifyQuestions: data.questions.filter(
        (q) => q.coStatus === "UNABLE_TO_VERIFY",
      ).length,
      missingDataQuestions: data.questions.filter(
        (q) => q.coStatus === "MISSING_DATA",
      ).length,
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
    const canonicalJSON = JSON.stringify(snapshot, Object.keys(snapshot).sort());
    const input = canonicalJSON + evaluationEngineVersion + promptVersion;
    return createHash("sha256").update(input, "utf-8").digest("hex");
  }

  private buildDistributions(data: RawBankData): DistributionData {
    const bloom: Record<string, number> = {};
    const difficulty: Record<string, number> = {};
    const coCoverage: Record<string, number> = {};
    const moduleCoverage: Record<string, number> = {};

    for (const q of data.questions) {
      if (q.rbtLevel) bloom[q.rbtLevel] = (bloom[q.rbtLevel] ?? 0) + 1;
      if (q.difficultyLevel) difficulty[q.difficultyLevel] = (difficulty[q.difficultyLevel] ?? 0) + 1;
      if (q.coMapping) coCoverage[q.coMapping] = (coCoverage[q.coMapping] ?? 0) + 1;
      const modKey = `Module ${q.moduleNumber}`;
      moduleCoverage[modKey] = (moduleCoverage[modKey] ?? 0) + 1;
    }

    return { bloom, difficulty, coCoverage, moduleCoverage };
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
