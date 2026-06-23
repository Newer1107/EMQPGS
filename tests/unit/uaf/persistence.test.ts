import { describe, it, expect, vi, beforeEach } from "vitest";
import { Persistence } from "@/lib/uaf/persistence";
import type { MetricResult } from "@/lib/uaf/metric-engine";
import type {
  EvidenceSnapshotData,
  AnalysisSnapshotResult,
} from "@/lib/uaf/types";

// ── Prisma Mock ──

const mockTx = {
  analysisSnapshot: { create: vi.fn() },
  uAFMetric: { create: vi.fn() },
  risk: { create: vi.fn() },
  recommendation: { create: vi.fn() },
  questionBankAnalysis: { update: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(
      (cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx),
    ),
  },
}));

// ── Helpers ──

function makeMetricResult(
  overrides?: Partial<MetricResult>,
): MetricResult {
  return {
    indexCode: "ECS" as any,
    value: 0.85,
    classification: "HIGHLY_EFFECTIVE" as any,
    weight: null,
    computationOrder: 1,
    formulaUsed: "test",
    ...overrides,
  };
}

function makeMetrics(): MetricResult[] {
  return [
    makeMetricResult({
      indexCode: "ECS" as any,
      value: 0.85,
      classification: "HIGHLY_EFFECTIVE" as any,
      weight: null,
      computationOrder: 1,
    }),
    makeMetricResult({
      indexCode: "EQI" as any,
      value: 0.78,
      classification: "EFFECTIVE" as any,
      weight: null,
      computationOrder: 2,
    }),
    makeMetricResult({
      indexCode: "QPQI" as any,
      value: 0.72,
      classification: "EFFECTIVE" as any,
      weight: null,
      computationOrder: 25,
    }),
    makeMetricResult({
      indexCode: "OCI" as any,
      value: 0.68,
      classification: "MEDIUM" as any,
      weight: null,
      computationOrder: 26,
    }),
    makeMetricResult({
      indexCode: "SCI" as any,
      value: 0.8,
      classification: "HIGHLY_EFFECTIVE" as any,
      weight: 0.1,
      computationOrder: 15,
    }),
  ];
}

function makeSnapshot(): EvidenceSnapshotData {
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
    detectedRisks: ["Low HOTS: 0.30"],
    outlierLists: [],
    supportingEvidence: {},
    representativeExamples: {},
  };
}

function makeAnalysisResult(
  overrides?: Partial<AnalysisSnapshotResult>,
): AnalysisSnapshotResult {
  return {
    analysisVersionId: "av-1",
    status: "COMPLETE",
    metrics: [
      {
        indexCode: "QPQI" as any,
        value: 0.72,
        classification: "EFFECTIVE" as any,
        weight: null,
        weightedScore: null,
      },
      {
        indexCode: "OCI" as any,
        value: 0.68,
        classification: "MEDIUM" as any,
        weight: null,
        weightedScore: null,
      },
    ],
    executiveSummary: null,
    finalVerdict: null,
    risks: [
      {
        finding: "Low HOTS coverage",
        priority: "HIGH",
        riskType: "CURRICULAR",
      },
    ],
    recommendations: [
      {
        finding: "Low HOTS coverage",
        recommendation: "Increase higher-order questions",
        priority: "HIGH",
      },
    ],
    aiModules: [],
    evidenceHash: "abc123def456",
    strengths: [],
    weaknesses: [],
    ...overrides,
  };
}

// ── Tests ──

describe("Persistence", () => {
  let persistence: Persistence;

  beforeEach(() => {
    vi.clearAllMocks();
    persistence = new Persistence();
  });

  it("creates an AnalysisSnapshot with full report and recommendations", async () => {
    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      makeAnalysisResult(),
    );

    expect(mockTx.analysisSnapshot.create).toHaveBeenCalledTimes(1);
    expect(mockTx.analysisSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        analysisVersionId: "av-1",
        recommendationsJson: expect.arrayContaining([
          expect.objectContaining({ finding: "Low HOTS coverage" }),
        ]),
      }),
    });

    // Verify fullReport contains result and snapshot
    const callArg = mockTx.analysisSnapshot.create.mock.calls[0][0];
    expect(callArg.data.fullReport).toHaveProperty("result");
    expect(callArg.data.fullReport).toHaveProperty("snapshot");
    expect(callArg.data.strengths).toEqual([]);
    expect(callArg.data.weaknesses).toEqual([]);
  });

  it("creates UAFMetric records for all metrics with correct fields", async () => {
    const metrics = makeMetrics();

    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      metrics,
      makeAnalysisResult(),
    );

    // Should create one record per metric (5 total)
    expect(mockTx.uAFMetric.create).toHaveBeenCalledTimes(metrics.length);

    // Check first metric
    expect(mockTx.uAFMetric.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionBankAnalysisId: "qba-1",
        indexCode: "ECS",
        value: 0.85,
        classification: "HIGHLY_EFFECTIVE",
        formulaUsed: "test",
        computationOrder: 1,
      }),
    });

    // Check metric with weight has computed weightedScore
    expect(mockTx.uAFMetric.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        indexCode: "SCI",
        value: 0.8,
        weight: 0.1,
        weightedScore: 0.08,
      }),
    });
  });

  it("computes weightedScore as value * weight for metrics with both", async () => {
    const metrics = [
      makeMetricResult({
        indexCode: "SCI" as any,
        value: 0.8,
        weight: 0.1,
        computationOrder: 15,
      }),
    ];

    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      metrics,
      makeAnalysisResult(),
    );

    expect(mockTx.uAFMetric.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        indexCode: "SCI",
        weightedScore: 0.08,
      }),
    });
  });

  it("sets weightedScore to null when value is null", async () => {
    const metrics = [
      makeMetricResult({
        indexCode: "QCQI" as any,
        value: null,
        classification: null as any,
        weight: 0.15,
        computationOrder: 21,
      }),
    ];

    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      metrics,
      makeAnalysisResult(),
    );

    expect(mockTx.uAFMetric.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        indexCode: "QCQI",
        weightedScore: null,
      }),
    });
  });

  it("sets weightedScore to null when weight is null", async () => {
    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      makeAnalysisResult(),
    );

    // ECS has weight = null, so weightedScore should be null
    const ecsCall = mockTx.uAFMetric.create.mock.calls.find(
      (call: any) => call[0].data.indexCode === "ECS",
    );
    expect(ecsCall[0].data.weightedScore).toBeNull();
  });

  it("saves Risk records from analysis result", async () => {
    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      makeAnalysisResult(),
    );

    expect(mockTx.risk.create).toHaveBeenCalledTimes(1);
    expect(mockTx.risk.create).toHaveBeenCalledWith({
      data: {
        questionBankAnalysisId: "qba-1",
        finding: "Low HOTS coverage",
        priority: "HIGH" as any,
        riskType: "CURRICULAR" as any,
      },
    });
  });

  it("saves multiple Risk records", async () => {
    const analysisResult = makeAnalysisResult({
      risks: [
        { finding: "Risk A", priority: "HIGH", riskType: "CURRICULAR" },
        { finding: "Risk B", priority: "MEDIUM", riskType: "STRUCTURAL" },
        { finding: "Risk C", priority: "LOW", riskType: null },
      ],
    });

    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      analysisResult,
    );

    expect(mockTx.risk.create).toHaveBeenCalledTimes(3);
  });

  it("saves Recommendation records from analysis result", async () => {
    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      makeAnalysisResult(),
    );

    expect(mockTx.recommendation.create).toHaveBeenCalledTimes(1);
    expect(mockTx.recommendation.create).toHaveBeenCalledWith({
      data: {
        questionBankAnalysisId: "qba-1",
        finding: "Low HOTS coverage",
        recommendation: "Increase higher-order questions",
        priority: "HIGH" as any,
      },
    });
  });

  it("saves multiple Recommendation records", async () => {
    const analysisResult = makeAnalysisResult({
      recommendations: [
        { finding: "A", recommendation: "Fix A", priority: "HIGH" },
        { finding: "B", recommendation: "Fix B", priority: "MEDIUM" },
      ],
    });

    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      analysisResult,
    );

    expect(mockTx.recommendation.create).toHaveBeenCalledTimes(2);
  });

  it("updates QuestionBankAnalysis with COMPLETE status and scores", async () => {
    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      makeAnalysisResult({ status: "COMPLETE" }),
    );

    expect(mockTx.questionBankAnalysis.update).toHaveBeenCalledWith({
      where: { id: "qba-1" },
      data: expect.objectContaining({
        status: "COMPLETE" as any,
        qpqi: 0.72,
        qpqiClassification: "EFFECTIVE" as any,
        oci: 0.68,
        completedAt: expect.any(Date),
      }),
    });
  });

  it("updates QuestionBankAnalysis with AI_COMPLETE status when result is AI_COMPLETE", async () => {
    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      makeAnalysisResult({ status: "AI_COMPLETE" }),
    );

    expect(mockTx.questionBankAnalysis.update).toHaveBeenCalledWith({
      where: { id: "qba-1" },
      data: expect.objectContaining({
        status: "AI_COMPLETE" as any,
      }),
    });
  });

  it("sets qpqi and oci to null when not in metrics", async () => {
    const analysisResult = makeAnalysisResult({
      metrics: [],
    });

    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      analysisResult,
    );

    expect(mockTx.questionBankAnalysis.update).toHaveBeenCalledWith({
      where: { id: "qba-1" },
      data: expect.objectContaining({
        qpqi: null,
        qpqiClassification: null,
        oci: null,
      }),
    });
  });

  it("runs all operations inside a single $transaction", async () => {
    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      makeAnalysisResult(),
    );

    const { prisma } = await import("@/lib/db");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("creates records in correct order within the same transaction", async () => {
    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      makeAnalysisResult(),
    );

    // AnalysisSnapshot first
    expect(mockTx.analysisSnapshot.create).toHaveBeenCalled();

    // Then metrics
    expect(mockTx.uAFMetric.create).toHaveBeenCalled();

    // Then risks
    expect(mockTx.risk.create).toHaveBeenCalled();

    // Then recommendations
    expect(mockTx.recommendation.create).toHaveBeenCalled();

    // Then analysis update last
    expect(mockTx.questionBankAnalysis.update).toHaveBeenCalled();
  });

  it("handles analysis with no risks gracefully", async () => {
    const analysisResult = makeAnalysisResult({ risks: [] });

    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      analysisResult,
    );

    expect(mockTx.risk.create).not.toHaveBeenCalled();
  });

  it("handles analysis with no recommendations gracefully", async () => {
    const analysisResult = makeAnalysisResult({ recommendations: [] });

    await persistence.save(
      "qba-1",
      "av-1",
      makeSnapshot(),
      makeMetrics(),
      analysisResult,
    );

    expect(mockTx.recommendation.create).not.toHaveBeenCalled();
  });
});
