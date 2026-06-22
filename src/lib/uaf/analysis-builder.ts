import { IndexCode, Classification, FinalVerdict } from "@prisma/client";
import type { EvidenceSnapshotData, ValidatedAIResponse, AnalysisSnapshotResult } from "./types";
import type { MetricResult } from "./metric-engine";

export class AnalysisBuilder {
  /**
   * Assembles the final AnalysisSnapshot from deterministic metrics + validated AI response.
   * This is the merge point where deterministic and AI-derived data come together.
   */
  async assemble(
    _questionBankAnalysisId: string,
    analysisVersionId: string,
    _evidenceSnapshotData: EvidenceSnapshotData,
    metrics: MetricResult[],
    aiResponse: ValidatedAIResponse | null,
    evidenceHash: string | null,
  ): Promise<AnalysisSnapshotResult> {
    // Map metrics to the output shape, computing weightedScore from value × weight
    const metricRecords = metrics.map((m) => ({
      indexCode: m.indexCode as IndexCode,
      value: m.value,
      classification: m.classification as Classification | null,
      weight: m.weight,
      weightedScore:
        m.weight !== null && m.value !== null
          ? Math.round(m.value * m.weight * 10000) / 10000
          : null,
    }));

    // Extract risks and recommendations from AI response modules
    const risks: Array<{
      finding: string;
      priority: string;
      riskType: string | null;
    }> = [];
    const recommendations: Array<{
      finding: string;
      recommendation: string;
      priority: string;
    }> = [];

    if (aiResponse) {
      for (const mod of aiResponse.modules) {
        if (
          mod.moduleId === "RISK_ANALYSIS" &&
          mod.success &&
          mod.data
        ) {
          const riskData = mod.data as {
            risks?: Array<{
              finding: string;
              priority: string;
              riskType?: string;
            }>;
          };
          if (riskData.risks) {
            risks.push(
              ...riskData.risks.map((r) => ({
                finding: r.finding,
                priority: r.priority,
                riskType: r.riskType ?? null,
              })),
            );
          }
        }
        if (
          mod.moduleId === "RECOMMENDATIONS" &&
          mod.success &&
          mod.data
        ) {
          const recData = mod.data as {
            recommendations?: Array<{
              finding: string;
              recommendation: string;
              priority: string;
            }>;
          };
          if (recData.recommendations) {
            recommendations.push(...recData.recommendations);
          }
        }
      }
    }

    // Extract executive summary and final verdict from AI modules
    let executiveSummary: string | null = null;
    let finalVerdict: FinalVerdict | null = null;

    if (aiResponse) {
      for (const mod of aiResponse.modules) {
        if (
          mod.moduleId === "EXECUTIVE_SUMMARY" &&
          mod.success &&
          mod.data
        ) {
          const summaryData = mod.data as { executiveSummary?: string };
          if (summaryData.executiveSummary) {
            executiveSummary = summaryData.executiveSummary;
          }
        }
        if (
          mod.moduleId === "FINAL_VERDICT" &&
          mod.success &&
          mod.data
        ) {
          const verdictData = mod.data as { verdict?: string };
          if (verdictData.verdict) {
            finalVerdict = verdictData.verdict as FinalVerdict;
          }
        }
      }
    }

    return {
      analysisVersionId,
      status: aiResponse?.overallValid !== false ? "COMPLETE" : "AI_COMPLETE",
      metrics: metricRecords,
      executiveSummary,
      finalVerdict,
      risks,
      recommendations,
      aiModules: aiResponse?.modules ?? [],
      evidenceHash,
    };
  }
}
