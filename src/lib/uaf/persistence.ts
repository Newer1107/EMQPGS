import { prisma } from "@/lib/db";
import type { EvidenceSnapshotData, AnalysisSnapshotResult } from "./types";
import type { MetricResult } from "./metric-engine";
import { MetricEngine } from "./metric-engine";
import { SnapshotBuilder } from "./snapshot-builder";
import { computeConfidence } from "./classification-matrix";
import type { RawBankData } from "./types";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { AnalysisStatus, RiskPriority, RiskType } from "@prisma/client";

// MySQL's default String column is varchar(191). Preserve long source material
// in TEXT/JSON and use a deterministic digest as the relational lookup key.
function sourceKey(reference: string): string {
  return reference.length <= 191 ? reference : `evidence:sha256:${createHash("sha256").update(reference).digest("hex")}`;
}

const capturedQuestionSchema = z.object({
  id: z.string().min(1), questionText: z.string().min(1),
  marks: z.number().finite().positive(), moduleNumber: z.number().int().positive(),
  coMapping: z.string().nullable().default(null), rbtLevel: z.string().nullable().default(null),
  difficultyLevel: z.string().nullable().default(null), questionType: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
});

function capturedQuestions(paperJson: unknown) {
  if (!paperJson || typeof paperJson !== "object" || Array.isArray(paperJson)) return null;
  const data = paperJson as Record<string, unknown>;
  for (const candidate of [data.selectedQuestions, data.questions, data.questionSnapshots]) {
    const parsed = z.array(capturedQuestionSchema).min(1).safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  return null;
}

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
          fullReport: JSON.parse(JSON.stringify({ result: analysisResult, snapshot: snapshotData })),
          strengths: JSON.parse(JSON.stringify(analysisResult.strengths)),
          weaknesses: JSON.parse(JSON.stringify(analysisResult.weaknesses)),
          recommendationsJson: JSON.parse(JSON.stringify(analysisResult.recommendations)),
        },
      });

      // 2. Save all metric values
      for (const m of metrics) {
        const counts = snapshotData.indexConfidence?.[m.indexCode];
        const confidence = counts && Number.isInteger(counts.verified) && Number.isInteger(counts.required)
          && counts.required > 0 && counts.verified >= 0 && counts.verified <= counts.required
          ? { verifiedItems: counts.verified, requiredItems: counts.required,
              ...computeConfidence(counts.verified, counts.required) } : undefined;
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
            ...(confidence && confidence.score !== null && confidence.percentage !== null && confidence.classification !== null
              && m.confidenceScore !== null && (m.confidenceScore === undefined || Math.abs(m.confidenceScore - confidence.score) < 1e-10)
              ? { confidence: { create: { ...confidence, score: confidence.score, percentage: confidence.percentage, classification: confidence.classification } } } : {}),
          },
        });
      }

      for (const question of snapshotData.questions ?? []) {
        if (!question.sourceQuestionId) continue;
        await tx.analysisEvidence.create({ data: {
          questionBankAnalysisId, evidenceType: "DIRECT", level: 1,
          category: "QUESTION", sourceReference: sourceKey(question.sourceQuestionId),
          description: question.sourceQuestionId.length > 191
            ? `${question.questionText}\nSource: ${question.sourceQuestionId}` : question.questionText,
        } });
      }
      for (const [category, references] of Object.entries(snapshotData.supportingEvidence)) {
        for (const sourceReference of new Set(references)) {
          await tx.analysisEvidence.create({ data: {
            questionBankAnalysisId, evidenceType: "METADATA", level: 2,
            category, sourceReference: sourceKey(sourceReference),
            description: sourceReference,
          } });
        }
      }
      for (const [category, reviews] of Object.entries(snapshotData.academicEvidence ?? {})) {
        for (const review of reviews ?? []) {
          for (const sourceReference of new Set(review.sourceIds)) {
            await tx.analysisEvidence.create({ data: {
              questionBankAnalysisId, evidenceType: "PROFESSIONAL_JUDGEMENT", level: 4,
              category, description: `${review.criterion}: ${review.score ?? "unavailable"}\nSource: ${sourceReference}`,
              sourceReference: sourceKey(sourceReference),
            } });
          }
        }
      }

      // Recompute per-paper metrics from its selected questions. Bank-wide scores
      // and reviewed academic judgments cannot be transferred to a paper.
      const papers = await tx.generatedPaper.findMany({
        where: { status: "COMPLETED", questionBank: { questionBankAnalyses: { some: { id: questionBankAnalysisId } } } },
        include: { items: { include: { question: true } } },
      });
      for (const paper of papers) {
        const captured = capturedQuestions(paper.paperJson);
        const sourceQuestions = captured ?? paper.items.map(({ question }) => question);
        const provenance = {
          source: captured ? "GENERATION_SNAPSHOT" : "CURRENT_LINKED_RECORDS",
          statement: captured
            ? "Evaluated captured question records stored in this paper's generation JSON."
            : "Evaluated current linked question records, not the original paper at generation time. Linked questions may have changed since generation; an immutable question snapshot was unavailable or incomplete.",
          generatedAt: paper.generatedAt?.toISOString() ?? null,
          evaluatedAt: new Date().toISOString(),
        };
        const questions: RawBankData["questions"] = sourceQuestions.map((q, index) => ({
          sourceQuestionId: q.id, questionIndex: index + 1, questionText: q.questionText,
          marks: q.marks, moduleNumber: q.moduleNumber, coMapping: q.coMapping,
          rbtLevel: q.rbtLevel, difficultyLevel: q.difficultyLevel,
          questionType: (q as typeof q & { questionType?: string | null }).questionType ?? null, commandVerb: null,
          coStatus: q.coMapping ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          rbtStatus: q.rbtLevel ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          difficultyStatus: q.difficultyLevel ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          attributeStatuses: { questionId: "VERIFIED",
            questionText: q.questionText.trim() ? "VERIFIED" : "MISSING_DATA",
            marks: Number.isFinite(q.marks) && q.marks > 0 ? "VERIFIED" : "MISSING_DATA" },
          questionStatus: q.status, clarityScore: 0,
        }));
        const data: RawBankData = {
          questionBankId: paper.questionBankId, subjectName: "", subjectCode: "",
          totalSlots: questions.length, filledSlots: questions.length, questions, modules: [],
          totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
          marksOptions: [...new Set(questions.map((q) => q.marks))], extractionTimestamp: "",
          documentedCourseOutcomes: snapshotData.documentedCourseOutcomes,
          expectedBloomDistribution: snapshotData.expectedBloomDistribution,
          expectedDifficultyDistribution: snapshotData.expectedDifficultyDistribution,
        };
        const paperMetrics = new MetricEngine().computeAll(data);
        const evidence = new SnapshotBuilder().build(data, paperMetrics);
        await tx.paperAnalysis.create({ data: {
          questionBankAnalysisId, generatedPaperId: paper.id,
          indexValues: JSON.parse(JSON.stringify({
            ...Object.fromEntries(paperMetrics.map((m) => [m.indexCode, m.value])),
            evidence, provenance, generationEvidence: paper.paperJson,
          })),
        } });
      }

      // 3. Save risks extracted from AI analysis
      for (const r of analysisResult.risks) {
        const detail = r as typeof r & { evidenceReference?: string; educationalRisk?: string; institutionalRisk?: string | null; affectedModules?: string[]; affectedCOs?: string[] };
        await tx.risk.create({
          data: {
            questionBankAnalysisId,
            finding: r.finding,
            priority: r.priority as RiskPriority,
            riskType: (r.riskType as RiskType | undefined) ?? null,
            evidenceReference: detail.evidenceReference,
            educationalRisk: detail.educationalRisk,
            institutionalRisk: detail.institutionalRisk,
            affectedModules: detail.affectedModules,
            affectedCOs: detail.affectedCOs,
          },
        });
      }

      // 4. Save recommendations from AI analysis
      for (const r of analysisResult.recommendations) {
        const detail = r as typeof r & { evidenceReference?: string; impact?: string | null; suggestedActions?: string[] };
        await tx.recommendation.create({
          data: {
            questionBankAnalysisId,
            finding: r.finding,
            recommendation: r.recommendation,
            priority: r.priority as RiskPriority,
            evidenceReference: detail.evidenceReference,
            impact: detail.impact,
            suggestedActions: detail.suggestedActions,
          },
        });
      }

      // 5. Update analysis record with final scores, AI results, and status
      await tx.questionBankAnalysis.update({
        where: { id: questionBankAnalysisId },
        data: {
          status: analysisResult.status as AnalysisStatus,
          qpqi:
            analysisResult.metrics.find((m) => m.indexCode === "QPQI")
              ?.value ?? null,
          qpqiClassification:
            analysisResult.metrics.find((m) => m.indexCode === "QPQI")
              ?.classification ?? null,
          oci:
            analysisResult.metrics.find((m) => m.indexCode === "OCI")
              ?.value ?? null,
          ociClassification: metrics.find((m) => m.indexCode === "OCI")?.confidenceClassification ?? null,
          executiveSummary: analysisResult.executiveSummary,
          finalVerdict: analysisResult.finalVerdict,
          completedAt: new Date(),
        },
      });
    });
  }
}
