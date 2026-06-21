import { describe, it, expect } from "vitest";
import { aiOverlaySchema } from "@/modules/ai/types";

describe("AI Overlay Validation", () => {
  it("accepts valid overlay with all four fields", () => {
    const result = aiOverlaySchema.safeParse({
      executiveSummary: "Good coverage overall.",
      missingAreas: ["Module 3 has no questions."],
      qualityFindings: ["Too many easy questions."],
      bloomsBalance: "Balanced distribution.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts overlay with empty arrays", () => {
    const result = aiOverlaySchema.safeParse({
      executiveSummary: "No issues found.",
      missingAreas: [],
      qualityFindings: [],
      bloomsBalance: "Well balanced.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing executiveSummary", () => {
    const result = aiOverlaySchema.safeParse({
      missingAreas: [],
      qualityFindings: [],
      bloomsBalance: "Balanced.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields like moduleCoverage", () => {
    const result = aiOverlaySchema.safeParse({
      executiveSummary: "Summary.",
      missingAreas: [],
      qualityFindings: [],
      bloomsBalance: "Balanced.",
      moduleCoverage: [{ label: "1", total: 21, approved: 10, missing: 11 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string executiveSummary", () => {
    const result = aiOverlaySchema.safeParse({
      executiveSummary: 123,
      missingAreas: [],
      qualityFindings: [],
      bloomsBalance: "Balanced.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-array missingAreas", () => {
    const result = aiOverlaySchema.safeParse({
      executiveSummary: "Summary.",
      missingAreas: "not an array",
      qualityFindings: [],
      bloomsBalance: "Balanced.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects numerical values in narrative fields", () => {
    const result = aiOverlaySchema.safeParse({
      executiveSummary: "Summary.",
      missingAreas: [],
      qualityFindings: [],
      bloomsBalance: "Balanced.",
      rbtDistribution: [{ key: "L1", count: 5, percentage: 50 }],
    });
    expect(result.success).toBe(false);
  });
});
