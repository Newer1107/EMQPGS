import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiOrchestrator } from "@/lib/uaf/ai-orchestrator";
import type { RawBankData, EvidenceSnapshotData, PipelineOptions } from "@/lib/uaf/types";
import type { MetricResult } from "@/lib/uaf/metric-engine";

// ── Shared Mock Functions ──

const mockCollect = vi.hoisted(() => vi.fn());
const mockComputeAll = vi.hoisted(() => vi.fn());
const mockBuildSnapshot = vi.hoisted(() => vi.fn());
const mockComputeHash = vi.hoisted(() => vi.fn());
const mockBuildPrompts = vi.hoisted(() => vi.fn());
const mockAnalyzeWithRetry = vi.hoisted(() => vi.fn());
const mockValidate = vi.hoisted(() => vi.fn());
const mockAssemble = vi.hoisted(() => vi.fn());
const mockSave = vi.hoisted(() => vi.fn());

// ── Pipeline Service Mocks ──

vi.mock("@/lib/uaf/evidence-builder", () => ({
  EvidenceBuilder: vi.fn().mockImplementation(() => ({ collect: mockCollect })),
}));

vi.mock("@/lib/uaf/metric-engine", () => ({
  MetricEngine: vi.fn().mockImplementation(() => ({ computeAll: mockComputeAll })),
}));

vi.mock("@/lib/uaf/snapshot-builder", () => ({
  SnapshotBuilder: vi.fn().mockImplementation(() => ({
    build: mockBuildSnapshot,
    computeEvidenceHash: mockComputeHash,
  })),
}));

vi.mock("@/lib/uaf/prompt-builder", () => ({
  PromptBuilder: vi.fn().mockImplementation(() => ({ build: mockBuildPrompts })),
}));

vi.mock("@/lib/uaf/ollama-service", () => ({
  OllamaService: vi.fn().mockImplementation(() => ({
    analyzeWithRetry: mockAnalyzeWithRetry,
  })),
}));

vi.mock("@/lib/uaf/response-validator", () => ({
  ResponseValidator: vi.fn().mockImplementation(() => ({ validate: mockValidate })),
}));

vi.mock("@/lib/uaf/analysis-builder", () => ({
  AnalysisBuilder: vi.fn().mockImplementation(() => ({ assemble: mockAssemble })),
}));

vi.mock("@/lib/uaf/persistence", () => ({
  Persistence: vi.fn().mockImplementation(() => ({ save: mockSave })),
}));

// ── Prisma Mock ──

const mockPrisma = vi.hoisted(() => ({
  questionBankAnalysis: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  analysisVersion: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  evidenceSnapshot: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

// ── Test Data ──

function makeRawBankData(overrides?: Partial<RawBankData>): RawBankData {
  return {
    questionBankId: "qb-1",
    subjectName: "Data Structures",
    subjectCode: "CS301",
    totalSlots: 42,
    filledSlots: 10,
    totalMarks: 100,
    extractionTimestamp: "2026-06-22T00:00:00.000Z",
    questions: [],
    modules: [],
    marksOptions: [2, 5, 10],
    ...overrides,
  };
}

function makeSnapshotData(
  overrides?: Partial<EvidenceSnapshotData>,
): EvidenceSnapshotData {
  return {
    totalQuestions: 5,
    verifiedQuestions: 3,
    unableToVerifyQuestions: 1,
    missingDataQuestions: 1,
    extractionCompletenessScore: 0.85,
    extractionQualityIndex: 0.78,
    metrics: { ECS: 0.85, EQI: 0.78 },
    distributions: {
      bloom: { REMEMBER: 2, UNDERSTAND: 2, APPLY: 1 },
      difficulty: { EASY: 2, MEDIUM: 2, HARD: 1 },
      coCoverage: { CO1: 2, CO2: 2, CO3: 1 },
      moduleCoverage: { "Module 1": 3, "Module 2": 2 },
      marksDistribution: {},
      questionTypeDistribution: {},
      questionStatusDistribution: {},
      moduleMarks: {},
    },
    detectedRisks: [],
    outlierLists: [],
    supportingEvidence: {},
    representativeExamples: {},
    ...overrides,
  };
}

function makeAnalysisResult() {
  return {
    analysisVersionId: "av-1",
    status: "COMPLETE",
    metrics: [],
    executiveSummary: null,
    finalVerdict: null,
    risks: [],
    recommendations: [],
    aiModules: [],
    evidenceHash: "hash123",
  };
}

// ── Tests ──

describe("AiOrchestrator", () => {
  let orchestrator: AiOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new AiOrchestrator();

    // Default successful pipeline
    mockPrisma.questionBankAnalysis.create.mockResolvedValue({
      id: "qba-1",
      questionBankId: "qb-1",
      status: "INITIALIZED",
    });

    mockCollect.mockResolvedValue(makeRawBankData());
    mockComputeAll.mockReturnValue([]);
    mockBuildSnapshot.mockReturnValue(makeSnapshotData());
    mockComputeHash.mockReturnValue("evidence-hash-abc");
    mockPrisma.analysisVersion.create.mockResolvedValue({
      id: "av-1",
      questionBankAnalysisId: "qba-1",
      versionNumber: 1,
    });
    mockPrisma.analysisVersion.findFirst.mockResolvedValue(null);

    mockBuildPrompts.mockResolvedValue({
      modules: [
        {
          moduleId: "EXECUTIVE_SUMMARY",
          promptText: "Analyze this",
          promptVersionId: "pv-1",
          contextBudget: 4000,
          outputSchema: {},
        },
      ],
      totalEstimatedTokens: 500,
    });

    mockAnalyzeWithRetry.mockResolvedValue({
      result: {
        text: '{"summary": "Good"}',
        model: "llama3.1",
        durationMs: 500,
      },
      retryCount: 0,
    });

    mockValidate.mockReturnValue({
      modules: [
        {
          moduleId: "EXECUTIVE_SUMMARY",
          success: true,
          data: { summary: "Good" },
          validationErrors: [],
          retryCount: 0,
        },
      ],
      overallValid: true,
    });

    mockAssemble.mockResolvedValue(makeAnalysisResult());

    mockPrisma.questionBankAnalysis.update.mockResolvedValue({});
    mockPrisma.evidenceSnapshot.create.mockResolvedValue({});
  });

  describe("analyze() - full pipeline", () => {
    it("completes the full 8-stage pipeline successfully", async () => {
      const result = await orchestrator.analyze("qb-1", "user-1");

      // Stage 1: Evidence collection
      expect(mockCollect).toHaveBeenCalledWith("qb-1");

      // Stage 2: Metric computation
      expect(mockComputeAll).toHaveBeenCalled();

      // Stage 3: Snapshot + hash
      expect(mockBuildSnapshot).toHaveBeenCalled();
      expect(mockComputeHash).toHaveBeenCalled();

      // Analysis version and evidence snapshot created
      expect(mockPrisma.analysisVersion.create).toHaveBeenCalled();
      expect(mockPrisma.evidenceSnapshot.create).toHaveBeenCalled();

      // Stage 4: Prompt building
      expect(mockBuildPrompts).toHaveBeenCalled();

      // Stage 5: Ollama call
      expect(mockAnalyzeWithRetry).toHaveBeenCalled();

      // Stage 6: Validation
      expect(mockValidate).toHaveBeenCalled();

      // Stage 7: Analysis assembly
      expect(mockAssemble).toHaveBeenCalled();

      // Stage 8: Persist
      expect(mockSave).toHaveBeenCalled();

      // Returns analysis result
      expect(result).toBeDefined();
      expect(result.status).toBe("COMPLETE");
    });

    it("creates QuestionBankAnalysis record on start", async () => {
      await orchestrator.analyze("qb-1", "user-1");

      expect(mockPrisma.questionBankAnalysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          questionBankId: "qb-1",
          status: "INITIALIZED" as any,
          triggeredById: "user-1",
        }),
      });
    });

    it("passes PipelineOptions through", async () => {
      const options: PipelineOptions = { forceRegenerate: true };
      await orchestrator.analyze("qb-1", "user-1", options);

      // Should still run AI pipeline (no cache check shortcut)
      expect(mockBuildPrompts).toHaveBeenCalled();
    });
  });

  describe("status progression", () => {
    it("updates status through correct sequence", async () => {
      await orchestrator.analyze("qb-1", "user-1");

      const updateCalls = mockPrisma.questionBankAnalysis.update.mock.calls;
      const statuses = updateCalls.map(
        (call: any) => call[0].data.status,
      );

      expect(statuses).toContain("EXTRACTING");
      expect(statuses).toContain("COMPUTING");
      expect(statuses).toContain("AI_PENDING");
      expect(statuses).toContain("AI_COMPLETE");
      expect(statuses).toContain("COMPLETE");
    });

    it("sets startedAt on EXTRACTING status", async () => {
      await orchestrator.analyze("qb-1", "user-1");

      const extractingUpdate = mockPrisma.questionBankAnalysis.update.mock.calls.find(
        (call: any) => call[0].data.status === "EXTRACTING",
      );

      expect(extractingUpdate[0].data.startedAt).toBeInstanceOf(Date);
    });

    it("sets completedAt on COMPLETE status", async () => {
      await orchestrator.analyze("qb-1", "user-1");

      const completeUpdate = mockPrisma.questionBankAnalysis.update.mock.calls.find(
        (call: any) => call[0].data.status === "COMPLETE",
      );

      expect(completeUpdate[0].data.completedAt).toBeInstanceOf(Date);
    });

    it("skips AI pipeline stages on cache hit", async () => {
      // Prior version with same hash exists
      mockPrisma.analysisVersion.findFirst.mockResolvedValue({
        id: "av-prior",
        questionBankAnalysisId: "qba-prior",
        versionNumber: 1,
      });

      await orchestrator.analyze("qb-1", "user-1");

      // AI stages should NOT be called
      expect(mockBuildPrompts).not.toHaveBeenCalled();
      expect(mockAnalyzeWithRetry).not.toHaveBeenCalled();
      expect(mockValidate).not.toHaveBeenCalled();

      // But assembly and persistence still run
      expect(mockAssemble).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it("forces AI pipeline when forceRegenerate is true", async () => {
      // Prior version exists (cache hit would skip AI)
      mockPrisma.analysisVersion.findFirst.mockResolvedValue({
        id: "av-prior",
      });

      await orchestrator.analyze("qb-1", "user-1", { forceRegenerate: true });

      // AI stages SHOULD be called despite cache hit
      expect(mockBuildPrompts).toHaveBeenCalled();
      expect(mockAnalyzeWithRetry).toHaveBeenCalled();
      expect(mockValidate).toHaveBeenCalled();
    });

    it("skips cache check entirely when forceRegenerate is true", async () => {
      await orchestrator.analyze("qb-1", "user-1", { forceRegenerate: true });

      // findFirst should not have been called for cache check
      // (it may be called for other things, but the cache check findFirst
      //  requires evidenceHash and questionBankId)
      const findFirstCalls = mockPrisma.analysisVersion.findFirst.mock.calls;
      const cacheChecks = findFirstCalls.filter(
        (call: any) => call[0]?.where?.evidenceHash,
      );
      expect(cacheChecks).toHaveLength(0);
    });
  });

  describe("AI pipeline failure modes", () => {
    it("handles all Ollama retries exhausted gracefully", async () => {
      // All modules fail retry
      mockAnalyzeWithRetry.mockResolvedValue({
        result: null,
        retryCount: 3,
      });

      // Empty combined text produces validation failure
      mockValidate.mockReturnValue({
        modules: [
          {
            moduleId: "EXECUTIVE_SUMMARY",
            success: false,
            data: null,
            validationErrors: ["Invalid JSON response"],
            retryCount: 0,
          },
        ],
        overallValid: false,
      });

      mockAssemble.mockResolvedValue({
        ...makeAnalysisResult(),
        status: "AI_COMPLETE",
      });

      const result = await orchestrator.analyze("qb-1", "user-1");

      // Pipeline completes without throwing
      expect(result).toBeDefined();
      // AI pipeline was invoked despite all failures
      expect(mockAnalyzeWithRetry).toHaveBeenCalled();
      expect(mockValidate).toHaveBeenCalled();
      // Deterministic metrics still flow through assembly and persistence
      expect(mockAssemble).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      // Status reflects AI completed (partially)
      expect(result.status).toBe("AI_COMPLETE");
    });
  });

  describe("error handling", () => {
    it("sets FAILED status when error occurs", async () => {
      mockCollect.mockRejectedValue(new Error("Database connection failed"));

      await expect(orchestrator.analyze("qb-1", "user-1")).rejects.toThrow(
        "Database connection failed",
      );

      // Should set FAILED status
      expect(mockPrisma.questionBankAnalysis.update).toHaveBeenCalledWith({
        where: { id: "qba-1" },
        data: expect.objectContaining({
          status: "FAILED" as any,
          failureReason: "Database connection failed",
        }),
      });
    });

    it("includes error stack in errorDetails", async () => {
      mockBuildPrompts.mockRejectedValue(new Error("Prompt builder failed"));

      try {
        await orchestrator.analyze("qb-1", "user-1");
      } catch {
        // expected
      }

      const failedUpdate = mockPrisma.questionBankAnalysis.update.mock.calls.find(
        (call: any) => call[0].data.status === "FAILED",
      );
      expect(failedUpdate[0].data.errorDetails).toHaveProperty("stack");
    });

    it("re-throws the original error", async () => {
      mockCollect.mockRejectedValue(new Error("Original error"));

      await expect(orchestrator.analyze("qb-1", "user-1")).rejects.toThrow(
        "Original error",
      );
    });

    it("sets FAILED on any stage failure", async () => {
      // Fail at metric computation
      mockComputeAll.mockImplementation(() => {
        throw new Error("Metric computation failed");
      });

      try {
        await orchestrator.analyze("qb-1", "user-1");
      } catch {
        // expected
      }

      expect(mockPrisma.questionBankAnalysis.update).toHaveBeenCalledWith({
        where: { id: "qba-1" },
        data: expect.objectContaining({
          status: "FAILED" as any,
          failureReason: "Metric computation failed",
        }),
      });
    });
  });

  describe("getStatus()", () => {
    it("returns latest analysis status for a question bank", async () => {
      mockPrisma.questionBankAnalysis.findFirst.mockResolvedValue({
        id: "qba-1",
        status: "COMPLETE",
        version: 1,
        qpqi: 0.72,
        qpqiClassification: "EFFECTIVE",
        startedAt: new Date("2026-06-22"),
        completedAt: new Date("2026-06-22"),
        failureReason: null,
      });

      const status = await orchestrator.getStatus("qb-1");

      expect(status).toMatchObject({
        id: "qba-1",
        status: "COMPLETE",
        qpqi: 0.72,
      });
      expect(mockPrisma.questionBankAnalysis.findFirst).toHaveBeenCalledWith({
        where: { questionBankId: "qb-1" },
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({
          id: true,
          status: true,
        }),
      });
    });

    it("returns null when no analysis exists", async () => {
      mockPrisma.questionBankAnalysis.findFirst.mockResolvedValue(null);

      const status = await orchestrator.getStatus("qb-nonexistent");

      expect(status).toBeNull();
    });
  });

  describe("orchestrator services isolation", () => {
    it("passes raw bank data from collect to computeAll", async () => {
      const rawData = makeRawBankData();
      mockCollect.mockResolvedValue(rawData);

      await orchestrator.analyze("qb-1", "user-1");

      expect(mockComputeAll).toHaveBeenCalledWith(rawData);
    });

    it("passes snapshot data to prompt builder", async () => {
      const snapshot = makeSnapshotData();
      mockBuildSnapshot.mockReturnValue(snapshot);

      await orchestrator.analyze("qb-1", "user-1");

      expect(mockBuildPrompts).toHaveBeenCalledWith(snapshot);
    });
  });
});
