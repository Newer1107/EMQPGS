import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromptBuilder } from "@/lib/uaf/prompt-builder";
import type { EvidenceSnapshotData } from "@/lib/uaf/types";
import { prisma } from "@/lib/db";

const mockPromptVersions = [
  {
    id: "pv-sys-1",
    moduleId: "SYSTEM_PREAMBLE",
    version: 1,
    promptText: "You are an expert assessment analyst.",
    outputSchema: null,
    contextBudget: null,
    createdAt: new Date("2026-01-01"),
    supersededAt: null,
  },
  {
    id: "pv-bloom-1",
    moduleId: "BLOOM_ANALYSIS",
    version: 1,
    promptText: "Analyze the bloom distribution: {evidence}",
    outputSchema: { type: "object", properties: { balance: { type: "string" } } },
    contextBudget: 4000,
    createdAt: new Date("2026-01-01"),
    supersededAt: null,
  },
  {
    id: "pv-exec-1",
    moduleId: "EXECUTIVE_SUMMARY",
    version: 1,
    promptText: "Summarize this: {evidence}",
    outputSchema: null,
    contextBudget: 2000,
    createdAt: new Date("2026-01-01"),
    supersededAt: null,
  },
];

vi.mock("@/lib/db", () => ({
  prisma: {
    promptVersion: {
      findMany: vi.fn(),
    },
  },
}));

function makeSnapshot(overrides?: Partial<EvidenceSnapshotData>): EvidenceSnapshotData {
  return {
    totalQuestions: 10,
    verifiedQuestions: 8,
    unableToVerifyQuestions: 1,
    missingDataQuestions: 1,
    extractionCompletenessScore: 0.85,
    extractionQualityIndex: 0.78,
    metrics: {
      ECS: 0.85,
      EQI: 0.78,
      BDI: 0.65,
      LOTS: 0.7,
      HOTS: 0.3,
      CBR: 0.5,
      DBI: 0.55,
      MCAI: 0.6,
      CVI: 0.72,
      QCQI: 0.8,
      QPQI: 0.75,
      OCI: 0.7,
    },
    distributions: {
      bloom: { REMEMBER: 3, UNDERSTAND: 3, APPLY: 2, ANALYZE: 1, EVALUATE: 1 },
      difficulty: { EASY: 4, MEDIUM: 4, HARD: 2 },
      coCoverage: { CO1: 3, CO2: 3, CO3: 2, CO4: 2 },
      moduleCoverage: { "Module 1": 3, "Module 2": 3, "Module 3": 4 },
    },
    detectedRisks: ["HOTS: NEEDS_IMPROVEMENT (0.30)", "BDI: low diversity"],
    outlierLists: [],
    supportingEvidence: {},
    representativeExamples: {},
    ...overrides,
  };
}

describe("PromptBuilder", () => {
  let builder: PromptBuilder;
  let mockFindMany: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    builder = new PromptBuilder();
    mockFindMany = vi.mocked(prisma.promptVersion.findMany);
  });

  describe("build()", () => {
    it("throws if no active PromptVersion records", async () => {
      mockFindMany.mockResolvedValue([]);
      await expect(builder.build(makeSnapshot())).rejects.toThrow(
        "No active prompt versions found",
      );
    });

    it("returns StructuredPrompts with correct module entries", async () => {
      mockFindMany.mockResolvedValue(mockPromptVersions);
      const result = await builder.build(makeSnapshot());

      expect(result).toHaveProperty("modules");
      expect(result).toHaveProperty("totalEstimatedTokens");
      expect(Array.isArray(result.modules)).toBe(true);
      // SYSTEM_PREAMBLE is excluded from modules
      expect(result.modules.length).toBe(2);
    });

    it("includes SYSTEM_PREAMBLE prompt prepended to each module", async () => {
      mockFindMany.mockResolvedValue(mockPromptVersions);
      const result = await builder.build(makeSnapshot());

      for (const mod of result.modules) {
        expect(mod.promptText).toContain("You are an expert assessment analyst.");
        expect(mod.promptText).toContain("---");
      }
    });

    it("substitutes {evidence} with module-specific JSON", async () => {
      mockFindMany.mockResolvedValue(mockPromptVersions);
      const result = await builder.build(makeSnapshot());

      const bloomModule = result.modules.find((m) => m.moduleId === "BLOOM_ANALYSIS");
      expect(bloomModule).toBeDefined();
      expect(bloomModule!.promptText).toContain("bloomDistribution");
      expect(bloomModule!.promptText).toContain("REMEMBER");

      const execModule = result.modules.find((m) => m.moduleId === "EXECUTIVE_SUMMARY");
      expect(execModule).toBeDefined();
      expect(execModule!.promptText).toContain("metrics");
      expect(execModule!.promptText).toContain("detectedRisks");
    });

    it("sets contextBudget from PromptVersion, defaulting to 4000", async () => {
      mockFindMany.mockResolvedValue(mockPromptVersions);
      const result = await builder.build(makeSnapshot());

      const bloomModule = result.modules.find((m) => m.moduleId === "BLOOM_ANALYSIS");
      expect(bloomModule!.contextBudget).toBe(4000);

      const execModule = result.modules.find((m) => m.moduleId === "EXECUTIVE_SUMMARY");
      expect(execModule!.contextBudget).toBe(2000);
    });

    it("includes module promptVersionId and outputSchema", async () => {
      mockFindMany.mockResolvedValue(mockPromptVersions);
      const result = await builder.build(makeSnapshot());

      const bloomModule = result.modules.find((m) => m.moduleId === "BLOOM_ANALYSIS");
      expect(bloomModule!.promptVersionId).toBe("pv-bloom-1");
      expect(bloomModule!.outputSchema).toEqual({
        type: "object",
        properties: { balance: { type: "string" } },
      });
    });

    it("works without SYSTEM_PREAMBLE", async () => {
      const versionsWithoutPreamble = mockPromptVersions.filter(
        (v) => v.moduleId !== "SYSTEM_PREAMBLE",
      );
      mockFindMany.mockResolvedValue(versionsWithoutPreamble);
      const result = await builder.build(makeSnapshot());

      expect(result.modules.length).toBe(2);
      // No preamble text should appear
      for (const mod of result.modules) {
        expect(mod.promptText).not.toContain("You are an expert assessment analyst.");
      }
    });

    it("returns a positive integer for totalEstimatedTokens", async () => {
      mockFindMany.mockResolvedValue(mockPromptVersions);
      const result = await builder.build(makeSnapshot());

      expect(result.totalEstimatedTokens).toBeGreaterThan(0);
      expect(Number.isInteger(result.totalEstimatedTokens)).toBe(true);
    });
  });

  describe("evidence per module", () => {
    it("includes bloomDistribution for BLOOM_ANALYSIS", async () => {
      mockFindMany.mockResolvedValue(
        mockPromptVersions.filter((v) => v.moduleId === "BLOOM_ANALYSIS" || v.moduleId === "SYSTEM_PREAMBLE"),
      );
      const result = await builder.build(makeSnapshot());
      expect(result.modules[0].promptText).toContain("bloomDistribution");
    });

    it("includes difficultyDistribution for DIFFICULTY_ANALYSIS", async () => {
      const pv = {
        id: "pv-diff-1",
        moduleId: "DIFFICULTY_ANALYSIS",
        version: 1,
        promptText: "Analyze: {evidence}",
        outputSchema: null,
        contextBudget: 4000,
        createdAt: new Date("2026-01-01"),
        supersededAt: null,
      };
      mockFindMany.mockResolvedValue([pv, mockPromptVersions[0]]);
      const result = await builder.build(makeSnapshot());
      const mod = result.modules.find((m) => m.moduleId === "DIFFICULTY_ANALYSIS")!;
      expect(mod.promptText).toContain("difficultyDistribution");
      expect(mod.promptText).toContain("dbi");
      expect(mod.promptText).toContain("mcai");
    });

    it("includes coDistribution for CO_COVERAGE", async () => {
      const pv = {
        id: "pv-co-1",
        moduleId: "CO_COVERAGE",
        version: 1,
        promptText: "Analyze: {evidence}",
        outputSchema: null,
        contextBudget: 4000,
        createdAt: new Date("2026-01-01"),
        supersededAt: null,
      };
      mockFindMany.mockResolvedValue([pv, mockPromptVersions[0]]);
      const result = await builder.build(makeSnapshot());
      const mod = result.modules.find((m) => m.moduleId === "CO_COVERAGE")!;
      expect(mod.promptText).toContain("coDistribution");
      expect(mod.promptText).toContain("cvi");
    });

    it("includes questionCount for CONCEPT_DIVERSITY", async () => {
      const pv = {
        id: "pv-cd-1",
        moduleId: "CONCEPT_DIVERSITY",
        version: 1,
        promptText: "Check: {evidence}",
        outputSchema: null,
        contextBudget: 4000,
        createdAt: new Date("2026-01-01"),
        supersededAt: null,
      };
      mockFindMany.mockResolvedValue([pv, mockPromptVersions[0]]);
      const result = await builder.build(makeSnapshot());
      const mod = result.modules.find((m) => m.moduleId === "CONCEPT_DIVERSITY")!;
      expect(mod.promptText).toContain("questionCount");
      expect(mod.promptText).toContain("10");
    });

    it("includes detectedRisks for RISK_ANALYSIS", async () => {
      const pv = {
        id: "pv-risk-1",
        moduleId: "RISK_ANALYSIS",
        version: 1,
        promptText: "Analyze risks: {evidence}",
        outputSchema: null,
        contextBudget: 4000,
        createdAt: new Date("2026-01-01"),
        supersededAt: null,
      };
      mockFindMany.mockResolvedValue([pv, mockPromptVersions[0]]);
      const result = await builder.build(makeSnapshot());
      const mod = result.modules.find((m) => m.moduleId === "RISK_ANALYSIS")!;
      expect(mod.promptText).toContain("detectedRisks");
      expect(mod.promptText).toContain("NEEDS_IMPROVEMENT");
    });

    it("includes qcqi for ACADEMIC_QUALITY", async () => {
      const pv = {
        id: "pv-aq-1",
        moduleId: "ACADEMIC_QUALITY",
        version: 1,
        promptText: "Score: {evidence}",
        outputSchema: null,
        contextBudget: 4000,
        createdAt: new Date("2026-01-01"),
        supersededAt: null,
      };
      mockFindMany.mockResolvedValue([pv, mockPromptVersions[0]]);
      const result = await builder.build(makeSnapshot());
      const mod = result.modules.find((m) => m.moduleId === "ACADEMIC_QUALITY")!;
      expect(mod.promptText).toContain("qcqi");
    });

    it("includes qpqi and oci for FINAL_VERDICT", async () => {
      const pv = {
        id: "pv-fv-1",
        moduleId: "FINAL_VERDICT",
        version: 1,
        promptText: "Verdict: {evidence}",
        outputSchema: null,
        contextBudget: 4000,
        createdAt: new Date("2026-01-01"),
        supersededAt: null,
      };
      mockFindMany.mockResolvedValue([pv, mockPromptVersions[0]]);
      const result = await builder.build(makeSnapshot());
      const mod = result.modules.find((m) => m.moduleId === "FINAL_VERDICT")!;
      expect(mod.promptText).toContain("qpqi");
      expect(mod.promptText).toContain("oci");
    });
  });
});
