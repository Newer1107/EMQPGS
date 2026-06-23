import { describe, it, expect } from "vitest";
import { AnalysisBuilder } from "@/lib/uaf/analysis-builder";
import type { MetricResult } from "@/lib/uaf/metric-engine";
import type {
  EvidenceSnapshotData,
  ValidatedAIResponse,
  AnalysisSnapshotResult,
} from "@/lib/uaf/types";

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
    // A metric WITH weight to test weightedScore computation
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
    detectedRisks: [],
    outlierLists: [],
    supportingEvidence: {},
    representativeExamples: {},
  };
}

function makeValidAIResponse(
  overrides?: Partial<ValidatedAIResponse>,
): ValidatedAIResponse {
  return {
    modules: [
      {
        moduleId: "RISK_ANALYSIS",
        success: true,
        data: {
          risks: [
            { finding: "Low HOTS coverage", priority: "HIGH", riskType: "CURRICULAR" },
          ],
        },
        validationErrors: [],
        retryCount: 0,
      },
      {
        moduleId: "RECOMMENDATIONS",
        success: true,
        data: {
          recommendations: [
            {
              finding: "Low HOTS coverage",
              recommendation: "Increase higher-order questions",
              priority: "HIGH",
            },
          ],
        },
        validationErrors: [],
        retryCount: 0,
      },
      {
        moduleId: "EXECUTIVE_SUMMARY",
        success: true,
        data: { executiveSummary: "Good overall" },
        validationErrors: [],
        retryCount: 0,
      },
      {
        moduleId: "FINAL_VERDICT",
        success: true,
        data: { verdict: "APPROVED_WITH_MINOR_IMPROVEMENTS" },
        validationErrors: [],
        retryCount: 0,
      },
    ],
    overallValid: true,
    ...overrides,
  };
}

// ── Tests ──

describe("AnalysisBuilder", () => {
  const builder = new AnalysisBuilder();

  describe("assemble()", () => {
    it("returns correct AnalysisSnapshotResult shape", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse(),
        "abc123",
      );

      expect(result).toHaveProperty("analysisVersionId", "av-1");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("executiveSummary");
      expect(result).toHaveProperty("finalVerdict");
      expect(result).toHaveProperty("risks");
      expect(result).toHaveProperty("recommendations");
      expect(result).toHaveProperty("aiModules");
      expect(result).toHaveProperty("evidenceHash", "abc123");
    });

    it("maps all metrics with indexCode, value, classification, weight, weightedScore", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse(),
        null,
      );

      expect(result.metrics).toHaveLength(5);

      const ecs = result.metrics.find((m) => m.indexCode === "ECS")!;
      expect(ecs.value).toBe(0.85);
      expect(ecs.classification).toBe("HIGHLY_EFFECTIVE");
      expect(ecs.weight).toBeNull();
      expect(ecs.weightedScore).toBeNull();

      const qpqi = result.metrics.find((m) => m.indexCode === "QPQI")!;
      expect(qpqi.value).toBe(0.72);
      expect(qpqi.classification).toBe("EFFECTIVE");

      const sci = result.metrics.find((m) => m.indexCode === "SCI")!;
      expect(sci.value).toBe(0.8);
      expect(sci.weight).toBe(0.1);
      // weightedScore = 0.8 * 0.1 = 0.08
      expect(sci.weightedScore).toBeCloseTo(0.08);
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

      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        metrics,
        makeValidAIResponse(),
        null,
      );

      expect(result.metrics[0].weightedScore).toBeNull();
    });

    it("sets weightedScore to null when weight is null", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse(),
        null,
      );

      // ECS has weight = null
      const ecs = result.metrics.find((m) => m.indexCode === "ECS")!;
      expect(ecs.weightedScore).toBeNull();
    });

    it("extracts risks from RISK_ANALYSIS AI module", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse(),
        null,
      );

      expect(result.risks).toHaveLength(1);
      expect(result.risks[0]).toEqual({
        finding: "Low HOTS coverage",
        priority: "HIGH",
        riskType: "CURRICULAR",
      });
    });

    it("extracts recommendations from RECOMMENDATIONS AI module", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse(),
        null,
      );

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0]).toEqual({
        finding: "Low HOTS coverage",
        recommendation: "Increase higher-order questions",
        priority: "HIGH",
      });
    });

    it("extracts multiple risks and recommendations", async () => {
      const aiResponse = makeValidAIResponse({
        modules: [
          {
            moduleId: "RISK_ANALYSIS",
            success: true,
            data: {
              risks: [
                { finding: "Risk A", priority: "HIGH", riskType: "CURRICULAR" },
                { finding: "Risk B", priority: "MEDIUM", riskType: "STRUCTURAL" },
              ],
            },
            validationErrors: [],
            retryCount: 0,
          },
          {
            moduleId: "RECOMMENDATIONS",
            success: true,
            data: {
              recommendations: [
                { finding: "Risk A", recommendation: "Fix A", priority: "HIGH" },
                { finding: "Risk B", recommendation: "Fix B", priority: "MEDIUM" },
              ],
            },
            validationErrors: [],
            retryCount: 0,
          },
        ],
        overallValid: true,
      });

      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        aiResponse,
        null,
      );

      expect(result.risks).toHaveLength(2);
      expect(result.recommendations).toHaveLength(2);
    });

    it("does not extract risks from failed RISK_ANALYSIS module", async () => {
      const aiResponse = makeValidAIResponse({
        modules: [
          {
            moduleId: "RISK_ANALYSIS",
            success: false,
            data: null,
            validationErrors: ["Invalid JSON"],
            retryCount: 2,
          },
        ],
        overallValid: false,
      });

      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        aiResponse,
        null,
      );

      expect(result.risks).toHaveLength(0);
    });

    it("does not extract recommendations from failed RECOMMENDATIONS module", async () => {
      const aiResponse = makeValidAIResponse({
        modules: [
          {
            moduleId: "RECOMMENDATIONS",
            success: false,
            data: null,
            validationErrors: ["Schema mismatch"],
            retryCount: 2,
          },
        ],
        overallValid: false,
      });

      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        aiResponse,
        null,
      );

      expect(result.recommendations).toHaveLength(0);
    });

    it("returns empty arrays when no AI response", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        null,
        null,
      );

      expect(result.risks).toEqual([]);
      expect(result.recommendations).toEqual([]);
      expect(result.aiModules).toEqual([]);
    });

    it("returns COMPLETE status when AI is valid", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse({ overallValid: true }),
        null,
      );

      expect(result.status).toBe("COMPLETE");
    });

    it("returns COMPLETE status when no AI response (null)", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        null,
        null,
      );

      // null aiResponse => overallValid !== false => COMPLETE
      expect(result.status).toBe("COMPLETE");
    });

    it("returns AI_COMPLETE status when AI has failures", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse({ overallValid: false }),
        null,
      );

      expect(result.status).toBe("AI_COMPLETE");
    });

    it("copies aiModules from AI response", async () => {
      const aiResponse = makeValidAIResponse();
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        aiResponse,
        null,
      );

      expect(result.aiModules).toHaveLength(4);
      expect(result.aiModules[0].moduleId).toBe("RISK_ANALYSIS");
      expect(result.aiModules[1].moduleId).toBe("RECOMMENDATIONS");
      expect(result.aiModules[2].moduleId).toBe("EXECUTIVE_SUMMARY");
      expect(result.aiModules[3].moduleId).toBe("FINAL_VERDICT");
    });

    it("extracts executiveSummary from EXECUTIVE_SUMMARY AI module", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse(),
        null,
      );

      expect(result.executiveSummary).toBe("Good overall");
    });

    it("extracts finalVerdict from FINAL_VERDICT AI module", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse(),
        null,
      );

      expect(result.finalVerdict).toBe("APPROVED_WITH_MINOR_IMPROVEMENTS");
    });

    it("sets executiveSummary and finalVerdict to null when modules are absent", async () => {
      const aiResponse = makeValidAIResponse({
        modules: [
          {
            moduleId: "RISK_ANALYSIS",
            success: true,
            data: { risks: [] },
            validationErrors: [],
            retryCount: 0,
          },
        ],
        overallValid: true,
      });

      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        aiResponse,
        null,
      );

      expect(result.executiveSummary).toBeNull();
      expect(result.finalVerdict).toBeNull();
    });

    it("preserves evidenceHash", async () => {
      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        makeValidAIResponse(),
        "evidence-hash-value",
      );

      expect(result.evidenceHash).toBe("evidence-hash-value");
    });

    it("handles riskType being absent from AI data", async () => {
      const aiResponse = makeValidAIResponse({
        modules: [
          {
            moduleId: "RISK_ANALYSIS",
            success: true,
            data: {
              risks: [
                { finding: "No riskType", priority: "LOW" },
              ],
            },
            validationErrors: [],
            retryCount: 0,
          },
        ],
        overallValid: true,
      });

      const result = await builder.assemble(
        "qba-1",
        "av-1",
        makeSnapshot(),
        makeMetrics(),
        aiResponse,
        null,
      );

      expect(result.risks[0].riskType).toBeNull();
    });
  });
});
