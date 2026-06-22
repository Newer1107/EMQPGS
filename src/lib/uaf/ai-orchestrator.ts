import { prisma } from "@/lib/db";
import { EvidenceBuilder } from "./evidence-builder";
import { MetricEngine } from "./metric-engine";
import { SnapshotBuilder } from "./snapshot-builder";
import { PromptBuilder } from "./prompt-builder";
import { OllamaService } from "./ollama-service";
import { ResponseValidator } from "./response-validator";
import { AnalysisBuilder } from "./analysis-builder";
import { Persistence } from "./persistence";
import type { PipelineOptions, AnalysisSnapshotResult } from "./types";

const EVALUATION_ENGINE_VERSION = "1.0.0";
const ANALYSIS_SCHEMA_VERSION = "1.0.0";

export class AiOrchestrator {
  private evidenceBuilder = new EvidenceBuilder();
  private metricEngine = new MetricEngine();
  private snapshotBuilder = new SnapshotBuilder();
  private promptBuilder = new PromptBuilder();
  private ollamaService = new OllamaService();
  private responseValidator = new ResponseValidator();
  private analysisBuilder = new AnalysisBuilder();
  private persistence = new Persistence();

  /**
   * Run the complete 8-stage analysis pipeline for a QuestionBank.
   *
   * Stages:
   *   1. Evidence Collection (extract bank data)
   *   2. Metric Computation (26 deterministic indexes)
   *   3. Snapshot Assembly + Hash (deterministic evidence package)
   *   4. Prompt Building (structured AI prompts)
   *   5. AI Inference (Ollama calls per module)
   *   6. Response Validation (hallucination guards, schema checks)
   *   7. Analysis Assembly (merge deterministic + AI results)
   *   8. Persistence (transactional save to DB)
   */
  async analyze(
    questionBankId: string,
    triggeredById: string,
    options: PipelineOptions = {},
  ): Promise<AnalysisSnapshotResult> {
    // 1. Resolve next version number and create analysis record
    const lastAnalysis = await prisma.questionBankAnalysis.findFirst({
      where: { questionBankId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastAnalysis?.version ?? 0) + 1;

    const analysis = await prisma.questionBankAnalysis.create({
      data: {
        questionBankId,
        version: nextVersion,
        status: "INITIALIZED" as any,
        triggeredById,
        evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
        analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
      },
    });

    try {
      // Stage 1: Evidence Collection
      await this.updateStatus(analysis.id, "EXTRACTING");
      const rawData = await this.evidenceBuilder.collect(questionBankId);

      // Stage 2: Metric Computation
      await this.updateStatus(analysis.id, "COMPUTING");
      const metrics = this.metricEngine.computeAll(rawData);

      // Stage 3: Snapshot Assembly + Hash
      const snapshotData = this.snapshotBuilder.build(rawData, metrics);
      const evidenceHash = this.snapshotBuilder.computeEvidenceHash(
        snapshotData,
        EVALUATION_ENGINE_VERSION,
        ANALYSIS_SCHEMA_VERSION,
      );

      // Create analysis version (immutable version record)
      const version = await prisma.analysisVersion.create({
        data: {
          questionBankAnalysisId: analysis.id,
          versionNumber: 1,
          evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
          analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
          evidenceHash,
        },
      });

      // Create evidence snapshot (persist the exact deterministic package)
      await prisma.evidenceSnapshot.create({
        data: {
          analysisVersionId: version.id,
          totalQuestions: snapshotData.totalQuestions,
          verifiedQuestions: snapshotData.verifiedQuestions,
          unableToVerifyQuestions: snapshotData.unableToVerifyQuestions,
          missingDataQuestions: snapshotData.missingDataQuestions,
          extractionCompletenessScore:
            snapshotData.extractionCompletenessScore,
          extractionQualityIndex: snapshotData.extractionQualityIndex,
          evidenceHash,
          sourceDataSnapshot: snapshotData as any,
        },
      });

      // Cache check: skip Ollama if same evidence hash exists for this bank
      let aiResponse: Awaited<
        ReturnType<typeof this.responseValidator.validate>
      > | null = null;

      if (!options.forceRegenerate) {
        const priorVersion = await prisma.analysisVersion.findFirst({
          where: {
            questionBankAnalysis: { questionBankId },
            evidenceHash,
            id: { not: version.id },
          },
          orderBy: { createdAt: "desc" },
        });

        if (priorVersion) {
          // Cache hit — skip AI pipeline, mark as AI_COMPLETE
          aiResponse = { modules: [], overallValid: true };
          await this.updateStatus(analysis.id, "AI_COMPLETE");
        }
      }

      // Stages 4-6: AI Pipeline (only if no cache hit)
      if (!aiResponse || options.forceRegenerate) {
        await this.updateStatus(analysis.id, "AI_PENDING");

        // Stage 4: Build structured prompts from snapshot
        const structuredPrompts = await this.promptBuilder.build(snapshotData);

        // Stage 5: Call Ollama for each AI module
        const rawResponses: Array<{
          rawText: string;
          model: string;
          durationMs: number;
        }> = [];

        for (const module of structuredPrompts.modules) {
          const { result } = await this.ollamaService.analyzeWithRetry(
            module.promptText,
            module.moduleId,
            { format: "json" },
          );
          if (result) {
            rawResponses.push({
              rawText: result.text,
              model: result.model,
              durationMs: result.durationMs,
            });
          }
        }

        // Combine all module responses into a single text block for validation
        const combinedText = rawResponses.map((r) => r.rawText).join("\n");
        const rawAiResponse = {
          rawText: combinedText,
          model: rawResponses[0]?.model ?? "unknown",
          durationMs: rawResponses.reduce((s, r) => s + r.durationMs, 0),
        };

        // Stage 6: Validate responses (hallucination guards, schema checks)
        aiResponse = this.responseValidator.validate(
          rawAiResponse,
          structuredPrompts,
        );
        await this.updateStatus(analysis.id, "AI_COMPLETE");
      }

      // Stage 7: Build final analysis snapshot
      const result = await this.analysisBuilder.assemble(
        analysis.id,
        version.id,
        snapshotData,
        metrics,
        aiResponse,
        evidenceHash,
      );

      // Stage 8: Persist everything in a single transaction
      await this.persistence.save(
        analysis.id,
        version.id,
        snapshotData,
        metrics,
        result,
      );

      await this.updateStatus(analysis.id, result.status);
      return result;
    } catch (error) {
      await prisma.questionBankAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "FAILED" as any,
          failureReason: (error as Error).message,
          errorDetails: { stack: (error as Error).stack },
        },
      });
      throw error;
    }
  }

  /**
   * Get the current status of the latest analysis for a QuestionBank.
   */
  async getStatus(questionBankId: string) {
    return prisma.questionBankAnalysis.findFirst({
      where: { questionBankId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        version: true,
        qpqi: true,
        qpqiClassification: true,
        startedAt: true,
        completedAt: true,
        failureReason: true,
      },
    });
  }

  private async updateStatus(analysisId: string, status: string) {
    await prisma.questionBankAnalysis.update({
      where: { id: analysisId },
      data: {
        status: status as any,
        startedAt: status === "EXTRACTING" ? new Date() : undefined,
        completedAt:
          status === "COMPLETE" || status === "FAILED"
            ? new Date()
            : undefined,
      },
    });
  }
}
