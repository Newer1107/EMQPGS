import { prisma } from "@/lib/db";
import { EvidenceBuilder } from "./evidence-builder";
import { MetricEngine } from "./metric-engine";
import { SnapshotBuilder } from "./snapshot-builder";
import { PromptBuilder } from "./prompt-builder";
import { OllamaService } from "./ollama-service";
import { ResponseValidator } from "./response-validator";
import { AnalysisBuilder } from "./analysis-builder";
import { Persistence } from "./persistence";
import { createHash } from "crypto";
import type { PipelineOptions, AnalysisSnapshotResult } from "./types";
import { UAF_ANALYSIS_FILTER } from "./pipeline";
import type { AnalysisStatus } from "@prisma/client";
export { UAF_ANALYSIS_FILTER } from "./pipeline";

const EVALUATION_ENGINE_VERSION = "1.1.0";
const ANALYSIS_SCHEMA_VERSION = "1.1.0";

export type OrchestrationResult = AnalysisSnapshotResult & {
  cacheHit: boolean;
  cachedFromAnalysisVersionId: string | null;
  aiUnavailableReason: string | null;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

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
  ): Promise<OrchestrationResult> {
    const analysis = await this.createRun(questionBankId, triggeredById);

    try {
      // Stage 1: Evidence Collection
      await this.updateStatus(analysis.id, "EXTRACTING");
      const rawData = await this.evidenceBuilder.collect(questionBankId);

      // Stage 2: Metric Computation
      await this.updateStatus(analysis.id, "COMPUTING");
      const metrics = this.metricEngine.computeAll(rawData);

      // Stage 3: Snapshot Assembly + Hash
      const snapshotData = this.snapshotBuilder.build(rawData, metrics);
      const structuredPrompts = await this.promptBuilder.build(snapshotData);
      const aiUnavailableReason = structuredPrompts.modules.length === 0
        ? "No active analysis prompts are registered. Deterministic analysis completed; AI details are unavailable."
        : null;
      const promptVersionString = createHash("sha256").update(canonical(
        structuredPrompts.modules.map((m) => ({ ...m })).sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
      )).digest("hex");
      const evidenceHash = this.snapshotBuilder.computeEvidenceHash(
        snapshotData,
        EVALUATION_ENGINE_VERSION,
        // Include the full nested evidence as well as the actual rendered prompts.
        canonical({ schema: ANALYSIS_SCHEMA_VERSION, promptVersionString, snapshotData }),
      );

      // Create analysis version (immutable version record)
      const version = await prisma.analysisVersion.create({
        data: {
          questionBankAnalysisId: analysis.id,
          versionNumber: analysis.version,
          promptVersionString,
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
          sourceDataSnapshot: JSON.parse(JSON.stringify(snapshotData)),
        },
      });

      // Only reuse complete, validated module outputs for this bank and evidence.
      const cached = options.forceRegenerate || aiUnavailableReason ? null : await prisma.analysisVersion.findFirst({
        where: {
          evidenceHash,
          promptVersionString,
          evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
          analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
          questionBankAnalysis: { questionBankId, status: "COMPLETE" },
          analysisSnapshot: { isNot: null },
        },
        orderBy: { createdAt: "desc" },
        include: { analysisSnapshot: true },
      });
      const report = cached?.analysisSnapshot?.fullReport as { result?: AnalysisSnapshotResult } | null;
      let aiResponse: ReturnType<ResponseValidator["validate"]> | null = null;
      let cacheHit = false;
      if (aiUnavailableReason) {
        aiResponse = { overallValid: false, modules: [{
          moduleId: "PROMPT_REGISTRY", success: false, data: null,
          validationErrors: [aiUnavailableReason], retryCount: 0,
        }] };
      }
      if (report?.result?.evidenceHash === evidenceHash && Array.isArray(report.result.aiModules)) {
        const cachedModules = report.result.aiModules;
        const modules = structuredPrompts.modules.flatMap((module) => {
          const output = cachedModules.find((m) => m && m.moduleId === module.moduleId && m.success === true);
          if (!output?.data) return [];
          return this.responseValidator.validate({ rawText: JSON.stringify(output.data), model: "cache", durationMs: 0 }, [module]).modules;
        });
        if (modules.length === structuredPrompts.modules.length && modules.every((m) => m.success)) {
          aiResponse = { modules, overallValid: true };
          cacheHit = true;
        }
      }
      if (!aiResponse) {
        await this.updateStatus(analysis.id, "AI_PENDING");
        const modules: ReturnType<ResponseValidator["validate"]>["modules"] = [];
        for (const modulePrompt of structuredPrompts.modules) {
          try {
            const { result, retryCount } = await this.ollamaService.analyzeWithRetry(
              modulePrompt.promptText,
              modulePrompt.moduleId,
              { format: "json" },
            );
            const validated = this.responseValidator.validate({
              rawText: result?.text ?? "", model: result?.model ?? "unknown", durationMs: result?.durationMs ?? 0,
            }, [modulePrompt]);
            modules.push(...validated.modules.map((m) => ({ ...m, retryCount })));
          } catch (error) {
            modules.push({ moduleId: modulePrompt.moduleId, success: false, data: null,
              validationErrors: [error instanceof Error ? error.message : String(error)], retryCount: 0 });
          }
        }
        aiResponse = { modules, overallValid: modules.every((m) => m.success) };
        await this.updateStatus(analysis.id, "AI_COMPLETE");
      }

      // Stage 7: Build final analysis snapshot (passing snapshotData for fallback generation)
      const assembled = await this.analysisBuilder.assemble(
        analysis.id,
        version.id,
        snapshotData,
        metrics,
        aiResponse,
        evidenceHash,
      );
      const result: OrchestrationResult = { ...assembled, cacheHit,
        cachedFromAnalysisVersionId: cacheHit ? cached!.id : null, aiUnavailableReason };

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
      const failure = error instanceof Error ? error : new Error(String(error));
      await prisma.questionBankAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "FAILED" as AnalysisStatus,
          // ponytail: truncate to 191 chars to avoid Prisma P2000 on varchar(191)
          failureReason: failure.message.slice(0, 190),
          errorDetails: { stack: failure.stack ?? "" },
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async createRun(questionBankId: string, triggeredById: string) {
    // Allocation MUST span both pipelines: the DB unique key is bank/version,
    // not bank/engine/version. Only status, history and cache reads are scoped.
    for (let attempt = 0; ; attempt++) {
      const last = await prisma.questionBankAnalysis.findFirst({
        where: { questionBankId }, orderBy: { version: "desc" }, select: { version: true },
      });
      try {
        return await prisma.questionBankAnalysis.create({ data: {
          questionBankId, triggeredById, version: (last?.version ?? 0) + 1,
          status: "INITIALIZED", evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
          analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
        } });
      } catch (error) {
        if (attempt >= 4 || (error as { code?: string }).code !== "P2002") throw error;
      }
    }
  }

  /**
   * Get the current status of the latest analysis for a QuestionBank.
   */
  async getStatus(questionBankId: string) {
    return prisma.questionBankAnalysis.findFirst({
      where: { questionBankId, ...UAF_ANALYSIS_FILTER },
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
        status: status as AnalysisStatus,
        startedAt: status === "EXTRACTING" ? new Date() : undefined,
        completedAt:
          status === "COMPLETE" || status === "FAILED"
            ? new Date()
            : undefined,
      },
    });
  }
}
