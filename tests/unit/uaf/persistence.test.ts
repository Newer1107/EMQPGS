import { describe, it, expect, vi, beforeEach } from "vitest";
import { Persistence } from "@/lib/uaf/persistence";
import { MetricEngine } from "@/lib/uaf/metric-engine";
import { AnalysisBuilder } from "@/lib/uaf/analysis-builder";
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
  generatedPaper: { findMany: vi.fn().mockResolvedValue([]) },
  paperAnalysis: { create: vi.fn() },
  analysisEvidence: { create: vi.fn() },
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
  it("stores long URLs and rationales losslessly with bounded stable relational keys", async () => {
    const url = `https://example.test/${"x".repeat(980)}`;
    const rationale = "Reviewed evidence. ".repeat(220);
    const snapshot = { ...makeSnapshot(), supportingEvidence: { ECS: [url] },
      academicEvidence: { QCQI: [{ criterion: "clarity", score: .4, sourceIds: ["uaf-review:review-1:QCQI:clarity", url, rationale] }] } };
    await new Persistence().save("qba", "av", snapshot, makeMetrics(), makeAnalysisResult());
    const saved = mockTx.analysisEvidence.create.mock.calls.map(([arg]) => arg.data);
    expect(saved.every((entry) => entry.sourceReference.length <= 191)).toBe(true);
    const urlEntries = saved.filter((entry) => entry.description.includes(url));
    expect(urlEntries).toHaveLength(2);
    expect(urlEntries[0].sourceReference).toBe(urlEntries[1].sourceReference);
    expect(saved.some((entry) => entry.description.includes(rationale))).toBe(true);
    expect(saved.some((entry) => entry.sourceReference === "uaf-review:review-1:QCQI:clarity")).toBe(true);
    expect(mockTx.analysisSnapshot.create.mock.calls[0][0].data.fullReport.snapshot.academicEvidence).toEqual(snapshot.academicEvidence);
  });
  it("persists supplied confidence counts and evidence references", async () => {
    const snapshot = { ...makeSnapshot(), indexConfidence: { ECS: { verified: 8, required: 10 } },
      supportingEvidence: { ECS: ["question:1", "question:1"] },
      academicEvidence: { QCQI: [{ criterion: "clarity", score: .8, sourceIds: ["review:1"] }] } };
    await new Persistence().save("qba", "av", snapshot, makeMetrics(), makeAnalysisResult());
    expect(mockTx.uAFMetric.create.mock.calls[0][0].data.confidence.create).toMatchObject({
      verifiedItems: 8, requiredItems: 10, score: .8, percentage: 80, classification: "HIGH",
    });
    expect(mockTx.analysisEvidence.create).toHaveBeenCalledTimes(2);
    expect(mockTx.analysisEvidence.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sourceReference: "review:1", evidenceType: "PROFESSIONAL_JUDGEMENT", level: 4 }) });
    expect(mockTx.analysisEvidence.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sourceReference: "question:1", evidenceType: "METADATA", level: 2 }) });
  });

  it("does not manufacture confidence counts when only a score is supplied", async () => {
    await new Persistence().save("qba", "av", makeSnapshot(),
      [makeMetricResult({ confidenceScore: .9, confidenceClassification: "VERY_HIGH" })], makeAnalysisResult());
    expect(mockTx.uAFMetric.create.mock.calls[0][0].data.confidence).toBeUndefined();
  });

  it.each([{ verified: 0, required: 0 }, { verified: -1, required: 10 }, { verified: 11, required: 10 }])("omits confidence rows for invalid counts %s", async (counts) => {
    await new Persistence().save("qba", "av", { ...makeSnapshot(), indexConfidence: { ECS: counts } }, makeMetrics(), makeAnalysisResult());
    expect(mockTx.uAFMetric.create.mock.calls[0][0].data.confidence).toBeUndefined();
  });

  it.each([null, .3, NaN])("omits rows when computed confidence %s is unavailable or conflicts with counts", async (confidenceScore) => {
    await new Persistence().save("qba", "av", { ...makeSnapshot(), indexConfidence: { ECS: { verified: 8, required: 10 } } },
      [makeMetricResult({ confidenceScore })], makeAnalysisResult());
    expect(mockTx.uAFMetric.create.mock.calls[0][0].data.confidence).toBeUndefined();
  });

  it("persists the same independent confidence as the computed report/UI", async () => {
    const indexConfidence = { ECS: { verified: 3, required: 4 } };
    const metrics = new MetricEngine().computeAll({ questionBankId: "qb", subjectName: "", subjectCode: "",
      totalSlots: 0, filledSlots: 0, questions: [], modules: [], totalMarks: 0, marksOptions: [], extractionTimestamp: "", indexConfidence });
    const snapshot = { ...makeSnapshot(), indexConfidence };
    const report = await new AnalysisBuilder().assemble("qba", "av", snapshot, metrics, null, null);
    await new Persistence().save("qba", "av", snapshot, metrics, report);
    const saved = mockTx.uAFMetric.create.mock.calls[0][0].data;
    expect(saved.value).toBeNull();
    expect(saved.confidence.create).toMatchObject({ verifiedItems: 3, requiredItems: 4, score: .75, percentage: 75, classification: "MEDIUM" });
    expect(mockTx.analysisSnapshot.create.mock.calls[0][0].data.fullReport.result.metrics[0].confidenceScore).toBe(.75);
  });

  it("persists paper-specific evidence and metrics instead of bank scores", async () => {
    const question = { id: "q1", questionText: "Explain trees.", marks: 5, moduleNumber: 1,
      coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "EASY", status: "APPROVED" };
    mockTx.generatedPaper.findMany.mockResolvedValueOnce([
      { id: "paper-a", questionBankId: "qb", paperJson: { questionIds: ["q1"], evaluationReport: { overall: 63 },
        scoreBreakdown: "Generator report", generationTrace: { slotDecisions: [{ selectedQuestionId: "q1" }] } }, items: [{ question }] },
      { id: "paper-b", questionBankId: "qb", paperJson: null, items: [{ question: { ...question, id: "q2", rbtLevel: "L5" } }] },
    ]);
    await new Persistence().save("qba", "av", makeSnapshot(), makeMetrics(), makeAnalysisResult());
    const records = mockTx.paperAnalysis.create.mock.calls.map(([arg]) => arg.data);
    expect(records).toHaveLength(2);
    expect(records[0].indexValues.QPQI).toBeNull();
    expect(records[0].indexValues.LOTS).toBe(1);
    expect(records[1].indexValues.LOTS).toBe(0);
    expect(records[0].indexValues.evidence.questions[0].sourceQuestionId).toBe("q1");
    expect(records[0].indexValues.generationEvidence.evaluationReport.overall).toBe(63);
    expect(records[0].indexValues.provenance.source).toBe("CURRENT_LINKED_RECORDS");
    expect(records[0].indexValues.provenance.statement).toContain("not the original paper at generation time");
    expect(records[0].aiNarrative).toBeUndefined();
    expect(mockTx.generatedPaper.findMany.mock.calls[0][0].where).toMatchObject({
      status: "COMPLETED", questionBank: { questionBankAnalyses: { some: { id: "qba" } } },
    });
  });

  it("propagates paper persistence failure from the transaction", async () => {
    mockTx.generatedPaper.findMany.mockRejectedValueOnce(new Error("paper read failed"));
    await expect(new Persistence().save("qba", "av", makeSnapshot(), makeMetrics(), makeAnalysisResult())).rejects.toThrow("paper read failed");
    expect(mockTx.questionBankAnalysis.update).not.toHaveBeenCalled();
  });

  it("prefers immutable captured paper questions over edited linked questions", async () => {
    const original = { id: "q1", questionText: "Original question", marks: 5, moduleNumber: 1, coMapping: "CO1", rbtLevel: "L2" };
    mockTx.generatedPaper.findMany.mockResolvedValueOnce([{ id: "paper", questionBankId: "qb",
      paperJson: { selectedQuestions: [original] }, items: [{ question: { ...original, questionText: "Edited question", rbtLevel: "L5" } }] }]);
    await new Persistence().save("qba", "av", makeSnapshot(), makeMetrics(), makeAnalysisResult());
    const values = mockTx.paperAnalysis.create.mock.calls[0][0].data.indexValues;
    expect(values.LOTS).toBe(1);
    expect(values.evidence.questions[0].questionText).toBe("Original question");
    expect(values.provenance.source).toBe("GENERATION_SNAPSHOT");
  });

  it("labels incomplete captured records as a current-record evaluation", async () => {
    mockTx.generatedPaper.findMany.mockResolvedValueOnce([{ id: "paper", questionBankId: "qb",
      paperJson: { questions: [{ id: "q1" }] }, items: [] }]);
    await new Persistence().save("qba", "av", makeSnapshot(), makeMetrics(), makeAnalysisResult());
    expect(mockTx.paperAnalysis.create.mock.calls[0][0].data.indexValues.provenance.source).toBe("CURRENT_LINKED_RECORDS");
  });
  let persistence: Persistence;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.generatedPaper.findMany.mockResolvedValue([]);
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
    expect(ecsCall![0].data.weightedScore).toBeNull();
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
