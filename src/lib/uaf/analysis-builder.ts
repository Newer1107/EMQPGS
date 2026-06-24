import { IndexCode, Classification, FinalVerdict } from "@prisma/client";
import type { EvidenceSnapshotData, ValidatedAIResponse, AnalysisSnapshotResult } from "./types";
import type { MetricResult } from "./metric-engine";
import { classifyIndex } from "./classification-matrix";

export class AnalysisBuilder {
  async assemble(
    _questionBankAnalysisId: string,
    analysisVersionId: string,
    evidenceSnapshotData: EvidenceSnapshotData,
    metrics: MetricResult[],
    aiResponse: ValidatedAIResponse | null,
    evidenceHash: string | null,
  ): Promise<AnalysisSnapshotResult> {
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

    // Extract from AI or generate fallback
    const aiData = aiResponse ? this.extractFromAi(aiResponse) : null;
    const fallback = this.generateFallbackData(metrics, evidenceSnapshotData);
    const executiveSummary = aiData?.executiveSummary ?? fallback.executiveSummary;
    const finalVerdict = aiData?.finalVerdict ?? fallback.finalVerdict;
    const risks = aiData?.risks.length ? aiData.risks : fallback.risks;
    const recommendations = aiData?.recommendations.length ? aiData.recommendations : fallback.recommendations;
    const strengths = aiData?.strengths.length ? aiData.strengths : fallback.strengths;
    const weaknesses = aiData?.weaknesses.length ? aiData.weaknesses : fallback.weaknesses;

    return {
      analysisVersionId,
      status: aiResponse?.overallValid !== false ? "COMPLETE" : "AI_COMPLETE",
      metrics: metricRecords,
      executiveSummary,
      finalVerdict,
      risks,
      recommendations,
      strengths,
      weaknesses,
      aiModules: aiResponse?.modules ?? [],
      evidenceHash,
    };
  }

  private extractFromAi(aiResponse: ValidatedAIResponse): {
    executiveSummary: string | null;
    finalVerdict: FinalVerdict | null;
    risks: Array<{ finding: string; priority: string; riskType: string | null }>;
    recommendations: Array<{ finding: string; recommendation: string; priority: string }>;
    strengths: Array<{ id: string; strength: string }>;
    weaknesses: Array<{ id: string; weakness: string }>;
  } {
    const result = {
      executiveSummary: null as string | null,
      finalVerdict: null as FinalVerdict | null,
      risks: [] as Array<{ finding: string; priority: string; riskType: string | null }>,
      recommendations: [] as Array<{ finding: string; recommendation: string; priority: string }>,
      strengths: [] as Array<{ id: string; strength: string }>,
      weaknesses: [] as Array<{ id: string; weakness: string }>,
    };

    for (const mod of aiResponse.modules) {
      if (!mod.success || !mod.data) continue;

      switch (mod.moduleId) {
        case "EXECUTIVE_SUMMARY": {
          const d = mod.data as { executiveSummary?: string; strengths?: Array<{ id: string; strength: string }>; weaknesses?: Array<{ id: string; weakness: string }> };
          if (d.executiveSummary) result.executiveSummary = d.executiveSummary;
          if (Array.isArray(d.strengths)) result.strengths.push(...d.strengths);
          if (Array.isArray(d.weaknesses)) result.weaknesses.push(...d.weaknesses);
          break;
        }
        case "RISK_ANALYSIS": {
          const d = mod.data as { risks?: Array<{ finding: string; priority: string; riskType?: string }> };
          if (d.risks) {
            result.risks.push(...d.risks.map((r) => ({ finding: r.finding, priority: r.priority, riskType: r.riskType ?? null })));
          }
          break;
        }
        case "RECOMMENDATIONS": {
          const d = mod.data as { recommendations?: Array<{ finding: string; recommendation: string; priority: string }> };
          if (d.recommendations) result.recommendations.push(...d.recommendations);
          break;
        }
        case "FINAL_VERDICT": {
          const d = mod.data as { verdict?: string };
          if (d.verdict) result.finalVerdict = d.verdict as FinalVerdict;
          break;
        }
      }
    }

    return result;
  }

  private generateFallbackData(metrics: MetricResult[], snapshot: EvidenceSnapshotData): {
    executiveSummary: string;
    finalVerdict: FinalVerdict | null;
    risks: Array<{ finding: string; priority: string; riskType: string | null }>;
    recommendations: Array<{ finding: string; recommendation: string; priority: string }>;
    strengths: Array<{ id: string; strength: string }>;
    weaknesses: Array<{ id: string; weakness: string }>;
  } {
    const qpqi = metrics.find((m) => m.indexCode === "QPQI")?.value ?? null;
    const sci = metrics.find((m) => m.indexCode === "SCI")?.value ?? null;
    const bdi = metrics.find((m) => m.indexCode === "BDI")?.value ?? null;
    const cvi = metrics.find((m) => m.indexCode === "CVI")?.value ?? null;
    const mcai = metrics.find((m) => m.indexCode === "MCAI")?.value ?? null;
    const dbi = metrics.find((m) => m.indexCode === "DBI")?.value ?? null;
    const qcqi = metrics.find((m) => m.indexCode === "QCQI")?.value ?? null;
    const cai = metrics.find((m) => m.indexCode === "CAI")?.value ?? null;
    const ami = metrics.find((m) => m.indexCode === "AMI")?.value ?? null;
    const fri = metrics.find((m) => m.indexCode === "FRI")?.value ?? null;
    const mii = metrics.find((m) => m.indexCode === "MII")?.value ?? null;

    const pct = (v: number | null) => v != null ? `${(v * 100).toFixed(0)}%` : "N/A";
    const totQ = snapshot.totalQuestions;
    const dist = snapshot.distributions;

    const executiveSummary =
      `Deterministic evaluation of question bank with ${totQ} questions. ` +
      `Overall Quality (QPQI): ${pct(qpqi)}. ` +
      `Structural Compliance: ${pct(sci)}. Metadata Integrity: ${pct(mii)}. ` +
      `Bloom Distribution: ${pct(bdi)}. Coverage: ${pct(cvi)}. ` +
      `Difficulty Balance: ${pct(dbi)}. Question Quality: ${pct(qcqi)}. ` +
      `Constructive Alignment: ${pct(cai)}. Moderation Readiness: ${pct(ami)}. Future Readiness: ${pct(fri)}. ` +
      (snapshot.detectedRisks.length > 0 ? `${snapshot.detectedRisks.length} risk(s) identified.` : "No critical risks detected.");

    // Deterministic verdict
    const finalVerdict: FinalVerdict | null = qpqi != null
      ? qpqi >= 0.9 ? "APPROVED_WITHOUT_MODIFICATION"
        : qpqi >= 0.8 ? "APPROVED_WITH_MINOR_IMPROVEMENTS"
          : qpqi >= 0.7 ? "APPROVED_SUBJECT_TO_REVISION"
            : qpqi >= 0.5 ? "MAJOR_REVISION_REQUIRED"
              : "NOT_APPROVED"
      : null;

    // Deterministic risk register from metric values
    const risks: Array<{ finding: string; priority: string; riskType: string | null }> = [];
    for (const m of metrics) {
      if (m.value === null) {
        risks.push({ finding: `${m.indexCode} could not be computed`, priority: "MODERATE", riskType: "EDUCATIONAL" });
      } else if (m.value < 0.5) {
        const priority = m.value < 0.3 ? "CRITICAL" : "MAJOR";
        risks.push({ finding: `${m.indexCode} at ${(m.value * 100).toFixed(0)}% — below acceptable threshold`, priority, riskType: "EDUCATIONAL" });
      } else if (m.value < 0.7) {
        risks.push({ finding: `${m.indexCode} at ${(m.value * 100).toFixed(0)}% — moderate concern`, priority: "MODERATE", riskType: "EDUCATIONAL" });
      }
    }

    // Deterministic recommendations
    const recommendations: Array<{ finding: string; recommendation: string; priority: string }> = [];
    if (sci != null && sci < 0.8) recommendations.push({ finding: "Low structural compliance", recommendation: "Ensure all required structural elements are present", priority: "MAJOR" });
    if (bdi != null && bdi < 0.7) recommendations.push({ finding: "Suboptimal Bloom distribution", recommendation: "Review question distribution across cognitive levels", priority: "MAJOR" });
    if (cvi != null && cvi < 0.6) recommendations.push({ finding: "Inadequate CO coverage", recommendation: "Distribute questions across more Course Outcomes", priority: "MAJOR" });
    if (mcai != null && mcai < 0.7) recommendations.push({ finding: "Marks-RBT misalignment detected", recommendation: "Review marks allocation against Bloom levels", priority: "MODERATE" });
    if (dbi != null && dbi < 0.7) recommendations.push({ finding: "Unbalanced difficulty distribution", recommendation: "Adjust Easy/Medium/Hard question ratio", priority: "MODERATE" });
    if (qcqi != null && qcqi < 0.7) recommendations.push({ finding: "Question quality concerns", recommendation: "Improve question clarity, precision, and alignment", priority: "MAJOR" });
    if (cai != null && cai < 0.7) recommendations.push({ finding: "Weak constructive alignment", recommendation: "Strengthen CO-to-assessment linkages", priority: "MAJOR" });
    if (ami != null && ami < 0.7) recommendations.push({ finding: "Moderation readiness below threshold", recommendation: "Complete missing metadata before moderation", priority: "MAJOR" });
    if (mii != null && mii < 0.7) recommendations.push({ finding: "Metadata gaps detected", recommendation: "Fill missing CO, RBT, and difficulty mappings", priority: "MAJOR" });
    if (!recommendations.length && qpqi != null && qpqi >= 0.8) {
      recommendations.push({ finding: "Overall quality is satisfactory", recommendation: "Maintain current standards", priority: "MINOR" });
    }

    // Deterministic strengths/weaknesses from metric values
    const strengths: Array<{ id: string; strength: string }> = [];
    const weaknesses: Array<{ id: string; weakness: string }> = [];
    let sIdx = 0, wIdx = 0;
    for (const m of metrics) {
      if (m.value !== null && m.value >= 0.8) strengths.push({ id: `S${++sIdx}`, strength: `${m.indexCode} at ${(m.value * 100).toFixed(0)}% — strong performance` });
      if (m.value !== null && m.value < 0.5) weaknesses.push({ id: `W${++wIdx}`, weakness: `${m.indexCode} at ${(m.value * 100).toFixed(0)}% — needs improvement` });
    }
    if (!strengths.length) strengths.push({ id: "S1", strength: "Question bank exists with structured metadata framework" });
    if (!weaknesses.length && qpqi != null && qpqi < 0.9) {
      weaknesses.push({ id: "W1", weakness: `Overall QPQI at ${(qpqi * 100).toFixed(0)}% — room for improvement across multiple dimensions` });
    }

    return { executiveSummary, finalVerdict, risks, recommendations, strengths, weaknesses };
  }
}
