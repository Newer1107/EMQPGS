import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResponseValidator } from "@/lib/uaf/response-validator";
import type { AIRawResponse, ModulePrompt, ValidatedAIResponse } from "@/lib/uaf/types";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function makeModulePrompt(
  moduleId: string,
  outputSchema: Record<string, string> = {},
): ModulePrompt {
  return {
    moduleId,
    promptText: "dummy prompt",
    promptVersionId: "pv-1",
    contextBudget: 4000,
    outputSchema,
  };
}

function makeRawResponse(data: unknown): AIRawResponse {
  return {
    rawText: JSON.stringify(data),
    model: "llama3.1",
    durationMs: 1000,
  };
}

function findModule(result: ValidatedAIResponse, moduleId: string) {
  return result.modules.find((m) => m.moduleId === moduleId)!;
}

describe("ResponseValidator", () => {
  let validator: ResponseValidator;

  beforeEach(() => {
    validator = new ResponseValidator();
  });

  describe("validate — JSON parsing", () => {
    it("parses valid JSON response with per-module data", () => {
      const rawResponse = makeRawResponse({
        BLOOM_ANALYSIS: { finding: "Balanced bloom", recommendation: "None" },
      });
      const modules = [makeModulePrompt("BLOOM_ANALYSIS", { finding: "string", recommendation: "string" })];

      const result = validator.validate(rawResponse, modules);

      expect(result.overallValid).toBe(true);
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0].success).toBe(true);
      expect(result.modules[0].data).toEqual({
        finding: "Balanced bloom",
        recommendation: "None",
      });
    });

    it("handles invalid JSON gracefully", () => {
      const rawResponse: AIRawResponse = {
        rawText: "not valid json at all",
        model: "llama3.1",
        durationMs: 1000,
      };
      const modules = [makeModulePrompt("BLOOM_ANALYSIS")];

      const result = validator.validate(rawResponse, modules);

      expect(result.overallValid).toBe(false);
      expect(result.modules[0].success).toBe(false);
      expect(result.modules[0].validationErrors).toContain("Invalid JSON response");
    });
  });

  describe("semantic hallucination guards", () => {
    it("Guard 1: Number Injection — flags excessive percentage values", () => {
      const rawResponse = makeRawResponse({
        MODULE_X: {
          finding:
            "10% 11% 12% 13% 14% 15% 16% 17% 18% 19% 20% 21% 22% 23% 24% 25% 26%",
          recommendation: "none",
        },
      });
      const modules = [makeModulePrompt("MODULE_X")];

      const result = validator.validate(rawResponse, modules);

      expect(result.modules[0].success).toBe(false);
      expect(result.modules[0].validationErrors.some((e) => e.includes("Guard 1"))).toBe(true);
    });

    it("Guard 2: Entity Name — flags out-of-range CO references", () => {
      const rawResponse = makeRawResponse({
        CO_ANALYSIS: {
          finding: "CO7 mapping is incomplete and CO10 is missing",
          recommendation: "Review CO coverage",
        },
      });
      const modules = [makeModulePrompt("CO_ANALYSIS")];

      const result = validator.validate(rawResponse, modules);

      expect(result.modules[0].success).toBe(false);
      expect(result.modules[0].validationErrors.some((e) => e.includes("Guard 2"))).toBe(true);
    });

    it("Guard 2: Entity Name — flags out-of-range module references", () => {
      const rawResponse = makeRawResponse({
        MODULE_X: {
          finding: "module 8 lacks complete coverage",
          recommendation: "Review coverage",
        },
      });
      const modules = [makeModulePrompt("MODULE_X")];

      const result = validator.validate(rawResponse, modules);

      expect(result.modules[0].success).toBe(false);
      expect(result.modules[0].validationErrors.some((e) => e.includes("Guard 2"))).toBe(true);
    });

    it("Guard 4: Field Mandate — flags missing required summary field", () => {
      const rawResponse = makeRawResponse({
        EXECUTIVE_SUMMARY: { someIrrelevantField: "value" },
      });
      const modules = [makeModulePrompt("EXECUTIVE_SUMMARY")];

      const result = validator.validate(rawResponse, modules);

      expect(result.modules[0].success).toBe(false);
      expect(result.modules[0].validationErrors).toContain(
        "Guard 4 (Field Mandate): Missing required summary/assessment field",
      );
    });

    it("Guard 4: Field Mandate — passes when EXECUTIVE_SUMMARY has required fields", () => {
      const rawResponse = makeRawResponse({
        EXECUTIVE_SUMMARY: {
          executiveSummary: "The bank is well-structured.",
          overallAssessment: "Good coverage across modules.",
        },
      });
      const modules = [makeModulePrompt("EXECUTIVE_SUMMARY")];

      const result = validator.validate(rawResponse, modules);

      expect(result.modules[0].success).toBe(true);
      expect(result.modules[0].data).toEqual({
        executiveSummary: "The bank is well-structured.",
        overallAssessment: "Good coverage across modules.",
      });
    });

    it("Guard 5: Length — flags oversized responses", () => {
      const longString = "x".repeat(5001);
      const rawResponse = makeRawResponse({
        MODULE_X: { finding: longString },
      });
      const modules = [makeModulePrompt("MODULE_X")];

      const result = validator.validate(rawResponse, modules);

      expect(result.modules[0].success).toBe(false);
      expect(result.modules[0].validationErrors.some((e) => e.includes("Guard 5"))).toBe(true);
    });
  });

  describe("cross-module behavior", () => {
    it("overallValid is false when any module fails", () => {
      const rawResponse = makeRawResponse({
        MODULE_A: { finding: "good", recommendation: "none" },
      });
      const modules = [
        makeModulePrompt("MODULE_A", { finding: "string", recommendation: "string" }),
        makeModulePrompt("MODULE_B", { finding: "string" }),
      ];

      const result = validator.validate(rawResponse, modules);

      // MODULE_A should succeed
      expect(findModule(result, "MODULE_A").success).toBe(true);
      // MODULE_B not found in response — falls back to parsed object which has MODULE_A key
      // The output for MODULE_B is the whole parsed object { MODULE_A: {...} }
      // This won't pass the strict schema for { finding: string }, so it will fail
      expect(result.overallValid).toBe(false);
    });

    it("one failing module does not affect others", () => {
      const rawResponse = makeRawResponse({
        MODULE_A: { finding: "good", recommendation: "none" },
        MODULE_B: { extraField: "bad" },
      });
      const modules = [
        makeModulePrompt("MODULE_A", { finding: "string", recommendation: "string" }),
        makeModulePrompt("MODULE_B", { finding: "string" }),
      ];

      const result = validator.validate(rawResponse, modules);

      const moduleA = findModule(result, "MODULE_A");
      const moduleB = findModule(result, "MODULE_B");

      expect(moduleA.success).toBe(true);
      expect(moduleA.data).toEqual({ finding: "good", recommendation: "none" });

      expect(moduleB.success).toBe(false);
      expect(moduleB.data).toBeNull();
      expect(moduleB.validationErrors.some((e) => e.includes("Schema validation failed"))).toBe(true);

      expect(result.overallValid).toBe(false);
    });
  });
});
