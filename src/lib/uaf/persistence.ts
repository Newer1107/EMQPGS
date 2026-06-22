import { prisma } from "@/lib/db";
import type { EvidenceSnapshotData, AnalysisSnapshotResult } from "./types";
import type { MetricResult } from "./metric-engine";

export class Persistence {
  /**
   * Persists an entire analysis run in a single transaction.
   * Creates all metric, risk, recommendation, and snapshot records atomically.
   */
  async save(
    questionBankAnalysisId: string,
    analysisVersionId: string,
    snapshotData: EvidenceSnapshotData,
    metrics: MetricResult[],
    analysisResult: AnalysisSnapshotResult,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. Save analysis snapshot (the full read model)
      await tx.analysisSnapshot.create({
        data: {
          analysisVersionId,
          fullReport: {
            result: analysisResult,
            snapshot: snapshotData,
          },
          strengths: [],
          weaknesses: [],
          recommendationsJson: analysisResult.recommendations,
        },
      });

      // 2. Save all metric values
      for (const m of metrics) {
        await tx.uAFMetric.create({
          data: {
            questionBankAnalysisId,
            indexCode: m.indexCode,
            value: m.value,
            classification: m.classification,
            weight: m.weight,
            weightedScore:
              m.weight !== null && m.value !== null
                ? Math.round(m.value * m.weight * 10000) / 10000
                : null,
            formulaUsed: m.formulaUsed,
            computationOrder: m.computationOrder,
          },
        });
      }

      // 3. Save risks extracted from AI analysis
      for (const r of analysisResult.risks) {
        await tx.risk.create({
          data: {
            questionBankAnalysisId,
            finding: r.finding,
            priority: r.priority as any,
            riskType: (r.riskType as any) ?? null,
          },
        });
      }

      // 4. Save recommendations from AI analysis
      for (const r of analysisResult.recommendations) {
        await tx.recommendation.create({
          data: {
            questionBankAnalysisId,
            finding: r.finding,
            recommendation: r.recommendation,
            priority: r.priority as any,
          },
        });
      }

      // 5. Update analysis record with final scores, AI results, and status
      await tx.questionBankAnalysis.update({
        where: { id: questionBankAnalysisId },
        data: {
          status: analysisResult.status,
          qpqi:
            analysisResult.metrics.find((m) => m.indexCode === "QPQI")
              ?.value ?? null,
          qpqiClassification:
            analysisResult.metrics.find((m) => m.indexCode === "QPQI")
              ?.classification ?? null,
          oci:
            analysisResult.metrics.find((m) => m.indexCode === "OCI")
              ?.value ?? null,
          executiveSummary: analysisResult.executiveSummary,
          finalVerdict: analysisResult.finalVerdict,
          completedAt: new Date(),
        },
      });
    });
  }
}
