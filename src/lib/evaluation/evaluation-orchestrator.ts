// ── Evaluation Orchestrator ───────────────────────────────────────
// Coordinates the evaluation pipeline:
//   1. Evidence collection (load bank data)
//   2. Deterministic computation (EvaluationEngine)
//   3. Evidence snapshot + hash
//   4. AI commentary (Ollama)
//   5. Report assembly
//   6. Persistence (reuses existing QuestionBankAnalysis models)

import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { EvaluationEngine } from "./evaluation-engine";
import { buildEvaluationPrompt, EVALUATION_PROMPT_VERSION } from "./evaluation-prompt";
import {
  EVALUATION_ENGINE_VERSION,
  EVALUATION_SCHEMA_VERSION,
  type EvaluationReport,
  type EvaluationBankData,
  type EvaluationQuestion,
  type EvaluationEvidence,
} from "./types";
import type { AnalysisStatus } from "@prisma/client";
import { createHash } from "node:crypto";

export class EvaluationOrchestrator {
  private engine = new EvaluationEngine();

  /**
   * Run the full evaluation pipeline for a question bank.
   * Returns the evaluation report with both deterministic and AI results.
   */
  async evaluate(
    questionBankId: string,
    triggeredById: string,
    options?: { forceRegenerate?: boolean },
  ): Promise<{ analysisId: string; versionId: string; report: EvaluationReport }> {
    const startWall = Date.now();
    logger.info("Evaluation started", { questionBankId, triggeredById, forceRegenerate: !!options?.forceRegenerate });

    // 1. Resolve next version
    const lastAnalysis = await prisma.questionBankAnalysis.findFirst({
      where: { questionBankId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastAnalysis?.version ?? 0) + 1;

    // 2. Create root analysis record
    const analysis = await prisma.questionBankAnalysis.create({
      data: {
        questionBankId,
        version: nextVersion,
        status: "INITIALIZED" as AnalysisStatus,
        triggeredById,
        evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
        analysisSchemaVersion: EVALUATION_SCHEMA_VERSION,
      },
    });

    try {
      // 3. Collect evidence
      const t0 = Date.now();
      await this.updateStatus(analysis.id, "EXTRACTING" as AnalysisStatus);
      const bankData = await this.collectEvidence(questionBankId);
      const questions = bankData.questions.filter((q) => q.questionText !== null);
      logger.info("Evidence collected", { analysisId: analysis.id, durationMs: Date.now() - t0, questions: questions.length });

      // 4. Deterministic computation
      const t1 = Date.now();
      await this.updateStatus(analysis.id, "COMPUTING" as AnalysisStatus);
      const deterministic = this.engine.evaluate(bankData);
      logger.info("Deterministic computed", { analysisId: analysis.id, durationMs: Date.now() - t1, overallAverage: deterministic.overallAverage });

      // 5. Build evidence snapshot
      const evidence: EvaluationEvidence = {
        totalQuestions: questions.length,
        totalModules: deterministic.moduleSummary.length,
        totalMarks: deterministic.moduleSummary.reduce((s, m) => s + m.totalMarks, 0),
        moduleSummaries: deterministic.moduleSummary,
        completenessPerModule: deterministic.attributeCompleteness,
        overallCompleteness: deterministic.overallCompletenessPct,
        rbtDistribution: deterministic.overallRbt,
        moduleRbt: deterministic.moduleRbt,
        difficultyDistribution: deterministic.overallDifficulty,
        marksDistribution: deterministic.overallMarks,
        coCoverage: deterministic.coCoverage,
        alignmentScore: deterministic.alignmentScore,
        qualityMetrics: deterministic.qualityMetrics,
        questionFindings: deterministic.questionFindings,
        consolidatedScores: deterministic.consolidatedScores,
        overallAverage: deterministic.overallAverage,
        verdict: deterministic.verdict,
      };
      const evidenceHash = this.computeHash(evidence, EVALUATION_ENGINE_VERSION);

      // 6. Create analysis version
      const t2 = Date.now();
      await this.updateStatus(analysis.id, "AI_PENDING" as AnalysisStatus);
      const version = await prisma.analysisVersion.create({
        data: {
          questionBankAnalysisId: analysis.id,
          versionNumber: 1,
          evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
          analysisSchemaVersion: EVALUATION_SCHEMA_VERSION,
          promptVersionString: EVALUATION_PROMPT_VERSION,
          evidenceHash,
        },
      });

      // 7. Persist evidence snapshot
      await prisma.evidenceSnapshot.create({
        data: {
          analysisVersionId: version.id,
          totalQuestions: evidence.totalQuestions,
          verifiedQuestions: evidence.totalQuestions - evidence.questionFindings.length,
          unableToVerifyQuestions: 0,
          missingDataQuestions: evidence.questionFindings.length,
          extractionCompletenessScore: evidence.overallCompleteness / 100,
          extractionQualityIndex: deterministic.overallAverage,
          evidenceHash,
          sourceDataSnapshot: JSON.parse(JSON.stringify(evidence)),
        },
      });
      logger.info("Version+snapshot persisted", { analysisId: analysis.id, versionId: version.id, durationMs: Date.now() - t2, evidenceSizeBytes: JSON.stringify(evidence).length });

      // 8. Cache check — skip AI if same hash exists
      let aiCommentary: Awaited<ReturnType<typeof this.callAiForCommentary>> | null = null;

      if (!options?.forceRegenerate) {
        const priorVersion = await prisma.analysisVersion.findFirst({
          where: {
            questionBankAnalysis: { questionBankId },
            evidenceHash,
            id: { not: version.id },
          },
          orderBy: { createdAt: "desc" },
        });
        if (priorVersion) {
          logger.info("Cache hit — skipping AI", { analysisId: analysis.id, evidenceHash });
          aiCommentary = {
            moduleSummaryNarrative: "Analysis reused from prior evaluation.",
            attributeNarrative: "",
            rbtNarrative: "",
            difficultyNarrative: "",
            marksNarrative: "",
            coCoverageNarrative: "",
            alignmentNarrative: "",
            qualityNarrative: "",
            finalAssessmentNarrative: "",
            verdictNarrative: "",
            findingsNarrative: "",
            strengths: [],
            weaknesses: [],
            improvementRoadmap: [],
          };
        }
      }

      // 9. Call AI for commentary (if no cache hit)
      if (!aiCommentary) {
        const t3 = Date.now();
        aiCommentary = await this.callAiForCommentary(evidence);
        logger.info("AI commentary complete", { analysisId: analysis.id, durationMs: Date.now() - t3, isFallback: aiCommentary.moduleSummaryNarrative.startsWith("The question bank contains") });
      }

      await this.updateStatus(analysis.id, "AI_COMPLETE" as AnalysisStatus);

      // 10. Assemble final report
      const report = this.assembleReport(bankData, deterministic, aiCommentary, evidenceHash);

      // 11. Persist analysis snapshot
      await this.updateStatus(analysis.id, "COMPLETE" as AnalysisStatus);
      await prisma.analysisSnapshot.create({
        data: {
          analysisVersionId: version.id,
          fullReport: JSON.parse(JSON.stringify(report)),
          strengths: aiCommentary.strengths,
          weaknesses: aiCommentary.weaknesses,
          recommendationsJson: { improvementRoadmap: aiCommentary.improvementRoadmap },
        },
      });

      logger.info("Evaluation complete", { analysisId: analysis.id, versionId: version.id, totalDurationMs: Date.now() - startWall, status: "COMPLETE" });
      return { analysisId: analysis.id, versionId: version.id, report };
    } catch (error) {
      logger.error("Evaluation failed", { analysisId: analysis.id, error: (error as Error).message, durationMs: Date.now() - startWall });
      await prisma.questionBankAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "FAILED" as AnalysisStatus,
          failureReason: (error as Error).message,
          errorDetails: { stack: (error as Error).stack },
        },
      });
      throw error;
    }
  }

  /**
   * Get the latest evaluation for a bank.
   */
  async getLatest(questionBankId: string) {
    const analysis = await prisma.questionBankAnalysis.findFirst({
      where: { questionBankId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        status: true,
        evaluationEngineVersion: true,
        completedAt: true,
        failureReason: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            evidenceHash: true,
            promptVersionString: true,
            createdAt: true,
            analysisSnapshot: { select: { fullReport: true, strengths: true, weaknesses: true } },
          },
        },
      },
    });
    return analysis;
  }

  /**
   * List all evaluation versions for a bank.
   */
  async listVersions(questionBankId: string) {
    return prisma.questionBankAnalysis.findMany({
      where: { questionBankId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        status: true,
        evaluationEngineVersion: true,
        ollamaModel: true,
        ollamaContext: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          select: {
            id: true,
            versionNumber: true,
            evidenceHash: true,
            promptVersionString: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Get a specific evaluation version with full report.
   */
  async getVersion(analysisVersionId: string) {
    return prisma.analysisVersion.findUnique({
      where: { id: analysisVersionId },
      include: {
        questionBankAnalysis: { select: { questionBankId: true, version: true, evaluationEngineVersion: true } },
        evidenceSnapshot: true,
        analysisSnapshot: true,
      },
    });
  }

  // ── Private Helpers ──────────────────────────────────────────

  private async collectEvidence(questionBankId: string): Promise<EvaluationBankData> {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: { select: { subjectName: true, subjectCode: true } },
        batchSemester: {
          select: {
            semesterNumber: true,
            academicYear: { select: { code: true } },
            department: { select: { name: true } },
            batch: { select: { name: true } },
          },
        },
        pattern: { select: { totalModules: true, marksPattern: true, slotsPerModule: true, totalSlots: true } },
        slots: {
          include: {
            assignedQuestion: {
              select: { questionText: true, marks: true, moduleNumber: true, coMapping: true, rbtLevel: true, difficultyLevel: true, status: true },
            },
          },
          orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
        },
      },
    });

    if (!bank) throw new NotFoundError("QuestionBank not found");

    const marksPattern = (bank.pattern?.marksPattern as number[]) ?? [2, 5, 10];
    const totalModules = bank.pattern?.totalModules ?? 6;

    const questions: EvaluationQuestion[] = bank.slots.map((slot) => ({
      slotId: slot.id,
      moduleNumber: slot.moduleNumber,
      marks: slot.marks,
      slotNumber: slot.slotNumber,
      questionText: slot.assignedQuestion?.questionText ?? null,
      coMapping: slot.assignedQuestion?.coMapping ? String(slot.assignedQuestion.coMapping) : null,
      rbtLevel: slot.assignedQuestion?.rbtLevel ? String(slot.assignedQuestion.rbtLevel) : null,
      difficultyLevel: slot.assignedQuestion?.difficultyLevel ? String(slot.assignedQuestion.difficultyLevel) : null,
      questionStatus: slot.assignedQuestion?.status ?? null,
      isLocked: slot.isLocked,
    }));

    const modules: number[] = [];
    for (let i = 1; i <= totalModules; i++) modules.push(i);

    return {
      questionBankId: bank.id,
      subjectName: bank.subject.subjectName,
      subjectCode: bank.subject.subjectCode,
      batchName: bank.batchSemester?.batch?.name ?? "",
      semesterNumber: bank.batchSemester?.semesterNumber ?? 0,
      academicYearCode: bank.batchSemester?.academicYear?.code ?? "",
      departmentName: bank.batchSemester?.department?.name ?? "",
      totalSlots: bank.pattern?.totalSlots ?? bank.slots.length,
      filledSlots: questions.filter((q) => q.questionText).length,
      questions,
      modules,
      marksOptions: marksPattern,
    };
  }

  private async callAiForCommentary(evidence: EvaluationEvidence): Promise<AiCommentaryResult> {
    const prompt = buildEvaluationPrompt(evidence);
    const promptChars = prompt.length;
    const estimatedTokens = Math.ceil(promptChars / 4);
    const findingsCount = evidence.questionFindings.length;

    logger.info("AI prompt built", {
      promptChars,
      estimatedTokens,
      findingsCount,
      questionCount: evidence.totalQuestions,
    });

    try {
      const { OllamaService } = await import("@/lib/uaf/ollama-service");
      const ollama = new OllamaService();
      // ponytail: single attempt — retries waste 360s when prompt is too big; fail fast → fallback
      const { result } = await ollama.analyzeWithRetry(prompt, "evaluation", {
        format: "json",
        context: 16384,
      });

      if (result) {
        logger.info("Ollama responded", {
          model: result.model,
          durationMs: result.durationMs,
          responseChars: result.text.length,
          tokensUsed: result.tokensUsed,
        });
        const parsed = this.parseAiResponse(result.text);
        if (parsed) return parsed;
        logger.warn("AI response parse failed — falling back to deterministic", {
          responsePreview: result.text.slice(0, 200),
        });
      } else {
        logger.warn("Ollama returned no result — falling back to deterministic");
      }
    } catch (error) {
      logger.warn("Ollama call failed — falling back to deterministic", {
        error: (error as Error).message,
      });
    }

    return this.buildFallbackCommentary(evidence);
  }

  private parseAiResponse(text: string): AiCommentaryResult | null {
    try {
      // Try to extract JSON from the response (it may have markdown wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        moduleSummaryNarrative: parsed.moduleSummaryNarrative ?? "",
        attributeNarrative: parsed.attributeNarrative ?? "",
        rbtNarrative: parsed.rbtNarrative ?? "",
        difficultyNarrative: parsed.difficultyNarrative ?? "",
        marksNarrative: parsed.marksNarrative ?? "",
        coCoverageNarrative: parsed.coCoverageNarrative ?? "",
        alignmentNarrative: parsed.alignmentNarrative ?? "",
        qualityNarrative: parsed.qualityNarrative ?? "",
        finalAssessmentNarrative: parsed.finalAssessmentNarrative ?? "",
        verdictNarrative: parsed.verdictNarrative ?? "",
        findingsNarrative: parsed.findingsNarrative ?? "",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        improvementRoadmap: Array.isArray(parsed.improvementRoadmap) ? parsed.improvementRoadmap : [],
      };
    } catch {
      return null;
    }
  }

  private buildFallbackCommentary(evidence: EvaluationEvidence): AiCommentaryResult {
    const pct = (evidence.overallAverage * 100).toFixed(0);
    const questionCount = evidence.totalQuestions;
    const completedModules = evidence.moduleSummaries.filter((m) => m.filledSlots > 0).length;

    return {
      moduleSummaryNarrative: `The question bank contains ${questionCount} questions across ${evidence.totalModules} modules, with ${completedModules} modules populated. ${evidence.totalModules - completedModules > 0 ? `${evidence.totalModules - completedModules} module(s) have no questions assigned.` : "All modules have questions assigned."}`,
      attributeNarrative: `Metadata completeness is at ${evidence.overallCompleteness}% overall. ${evidence.overallCompleteness >= 80 ? "This indicates good metadata discipline." : evidence.overallCompleteness >= 50 ? "Several questions are missing metadata attributes, which affects traceability." : "Significant metadata gaps exist — CO, RBT, and difficulty mappings should be completed."}`,
      rbtNarrative: this.buildRbtNarrative(evidence),
      difficultyNarrative: `The question bank has ${evidence.difficultyDistribution.easy} easy, ${evidence.difficultyDistribution.medium} medium, and ${evidence.difficultyDistribution.hard} hard questions. ${this.buildDifficultyNarrative(evidence)}`,
      marksNarrative: `Questions are distributed across ${Object.keys(evidence.marksDistribution).length} different mark values. ${this.buildMarksNarrative(evidence)}`,
      coCoverageNarrative: `${evidence.coCoverage.length} different Course Outcomes are mapped. ${evidence.coCoverage.length >= 3 ? "This provides reasonable CO coverage." : "CO coverage is limited — consider distributing questions across more outcomes."}`,
      alignmentNarrative: `Constructive alignment score is ${(evidence.alignmentScore * 100).toFixed(0)}%. ${evidence.alignmentScore >= 0.8 ? "Questions are well-aligned with outcomes and cognitive levels." : evidence.alignmentScore >= 0.5 ? "Some alignment gaps exist — review questions missing CO or RBT mappings." : "Significant alignment issues detected."}`,
      qualityNarrative: `Overall quality score across all modules is ${pct}%. Modules with higher completeness rates tend to score better on quality metrics. Focus improvement efforts on modules with lower clarity and relevance scores.`,
      finalAssessmentNarrative: `The question bank scores ${pct}% overall, placing it in the "${evidence.verdict.verdict}" category. Review the improvement roadmap below for recommended actions.`,
      verdictNarrative: `The bank's overall score of ${pct}% results in a verdict of "${evidence.verdict.verdict}". This is based on consolidated scores across clarity, relevance, RBT accuracy, and completeness dimensions.`,
      findingsNarrative: evidence.questionFindings.length > 0
        ? `${evidence.questionFindings.length} question-level issues were identified. These range from missing metadata to RBT-marks alignment concerns. Address these issues before proceeding to moderation.`
        : "No question-level issues were detected.",
      strengths: evidence.overallAverage >= 0.7
        ? ["Good overall quality score", "Adequate CO coverage across modules", "Questions are well-structured"]
        : ["Questions are present in the bank", "Module structure follows the template"],
      weaknesses: evidence.overallCompleteness < 80
        ? ["Incomplete metadata for several questions", "RBT and difficulty mappings need review"]
        : evidence.overallAverage < 0.7
          ? ["Overall quality below threshold", "Distribution imbalances may affect assessment validity"]
          : [],
      improvementRoadmap: [
        `Complete metadata for all ${evidence.totalQuestions} questions (CO, RBT, difficulty)`,
        "Review RBT distribution against ideal Bloom's taxonomy targets",
        evidence.coCoverage.length < 3 ? "Expand CO coverage across more outcomes" : "Ensure balanced question distribution across all modules",
        evidence.difficultyDistribution.hard === 0 ? "Add challenging questions to test higher-order thinking" : "Review difficulty progression across modules",
      ],
    };
  }

  private buildRbtNarrative(evidence: EvaluationEvidence): string {
    const { remember, understand, apply, analyze, evaluate, create } = evidence.rbtDistribution;
    const total = remember + understand + apply + analyze + evaluate + create || 1;
    const lotsPct = ((remember + understand + apply) / total * 100).toFixed(0);
    const hotsPct = ((analyze + evaluate + create) / total * 100).toFixed(0);

    if (parseInt(lotsPct) > 70) {
      return `The bank is heavily weighted toward lower-order thinking skills (${lotsPct}% LOTS). Consider adding more Analyze, Evaluate, and Create questions to develop higher-order cognitive skills.`;
    }
    if (parseInt(hotsPct) > 50) {
      return `The bank emphasizes higher-order thinking (${hotsPct}% HOTS), which is good for advanced assessments. Ensure foundational knowledge is also adequately covered through L1-L3 questions.`;
    }
    return `The bank has a balanced mix of LOTS (${lotsPct}%) and HOTS (${hotsPct}%), supporting progressive cognitive development.`;
  }

  private buildDifficultyNarrative(evidence: EvaluationEvidence): string {
    const { easy, medium, hard } = evidence.difficultyDistribution;
    const total = easy + medium + hard || 1;
    const hardPct = (hard / total * 100).toFixed(0);

    if (parseInt(hardPct) < 10) {
      return "Difficulty is skewed toward easier questions. Consider adding more challenging questions.";
    }
    if (parseInt(hardPct) > 40) {
      return "The bank is heavily skewed toward hard questions, which may demotivate students.";
    }
    return "Difficulty distribution provides reasonable differentiation between student performance levels.";
  }

  private buildMarksNarrative(evidence: EvaluationEvidence): string {
    const entries = Object.entries(evidence.marksDistribution);
    if (entries.length <= 1) return "Only one mark value is used — consider varying marks to differentiate assessment weight.";
    return "The marks distribution offers reasonable variety for assessment weighting.";
  }

  private assembleReport(
    bankData: EvaluationBankData,
    deterministic: Awaited<ReturnType<EvaluationEngine["evaluate"]>>,
    ai: AiCommentaryResult,
    evidenceHash: string,
  ): EvaluationReport {
    return {
      objective: {
        subjectName: bankData.subjectName,
        subjectCode: bankData.subjectCode,
        batchName: bankData.batchName,
        semesterNumber: bankData.semesterNumber,
        academicYear: bankData.academicYearCode,
        departmentName: bankData.departmentName,
        totalQuestions: deterministic.moduleSummary.reduce((s, m) => s + m.filledSlots, 0),
        evaluationDate: new Date().toISOString(),
        narrative: ai.moduleSummaryNarrative,
      },
      moduleSummary: deterministic.moduleSummary,
      moduleSummaryAiNarrative: ai.moduleSummaryNarrative,
      attributeCompleteness: deterministic.attributeCompleteness,
      overallCompletenessPct: deterministic.overallCompletenessPct,
      attributeAiNarrative: ai.attributeNarrative,
      overallRbt: deterministic.overallRbt,
      moduleRbt: deterministic.moduleRbt,
      idealDistribution: deterministic.idealDistribution,
      rbtAiNarrative: ai.rbtNarrative,
      overallDifficulty: deterministic.overallDifficulty,
      moduleDifficulty: deterministic.moduleDifficulty,
      difficultyAiNarrative: ai.difficultyNarrative,
      overallMarks: deterministic.overallMarks,
      moduleMarks: deterministic.moduleMarks,
      marksAiNarrative: ai.marksNarrative,
      coCoverage: deterministic.coCoverage,
      coCoverageAiNarrative: ai.coCoverageNarrative,
      alignmentSummary: {
        score: deterministic.alignmentScore,
        risks: [],
        recommendations: [],
      },
      alignmentAiNarrative: ai.alignmentNarrative,
      qualityMetrics: deterministic.qualityMetrics,
      qualityAiNarrative: ai.qualityNarrative,
      finalAssessments: deterministic.moduleSummary.map((m) => {
        const cs = deterministic.consolidatedScores.find((s) => s.moduleNumber === m.moduleNumber);
        const score = cs?.overallScore ?? 0;
        return {
          moduleNumber: m.moduleNumber,
          rating: score >= 0.8 ? "Highly Effective" : score >= 0.6 ? "Effective" : score >= 0.4 ? "Acceptable" : score >= 0.2 ? "Needs Improvement" : "Major Revision",
          threshold: score,
          strengths: m.filledSlots > 0 ? [`${m.filledSlots} questions assigned`] : [],
          weaknesses: m.filledSlots === 0 ? ["No questions assigned to this module"] : [],
          recommendations: m.filledSlots === 0 ? ["Assign questions to this module"] : [],
        };
      }),
      finalAssessmentAiNarrative: ai.finalAssessmentNarrative,
      consolidatedScores: deterministic.consolidatedScores,
      overallAverage: deterministic.overallAverage,
      verdict: deterministic.verdict,
      verdictAiNarrative: ai.verdictNarrative,
      questionFindings: deterministic.questionFindings,
      findingsAiNarrative: ai.findingsNarrative,
      engineVersion: EVALUATION_ENGINE_VERSION,
      promptVersion: EVALUATION_PROMPT_VERSION,
      generationDurationMs: 0,
    };
  }

  private computeHash(data: unknown, version: string): string {
    return createHash("sha256")
      .update(JSON.stringify({ data, version }))
      .digest("hex");
  }

  private async updateStatus(analysisId: string, status: AnalysisStatus) {
    await prisma.questionBankAnalysis.update({
      where: { id: analysisId },
      data: {
        status,
        startedAt: status === "EXTRACTING" ? new Date() : undefined,
        completedAt: status === "COMPLETE" || status === "FAILED" ? new Date() : undefined,
      },
    });
  }
}

// ── Types ─────────────────────────────────────────────────────────

interface AiCommentaryResult {
  moduleSummaryNarrative: string;
  attributeNarrative: string;
  rbtNarrative: string;
  difficultyNarrative: string;
  marksNarrative: string;
  coCoverageNarrative: string;
  alignmentNarrative: string;
  qualityNarrative: string;
  finalAssessmentNarrative: string;
  verdictNarrative: string;
  findingsNarrative: string;
  strengths: string[];
  weaknesses: string[];
  improvementRoadmap: string[];
}
