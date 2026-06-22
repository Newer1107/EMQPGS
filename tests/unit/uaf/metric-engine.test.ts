import { describe, it, expect } from "vitest";
import {
  classifyIndex,
  classifyConfidence,
  computeConfidence,
} from "@/lib/uaf/classification-matrix";
import {
  computeECS,
  computeEQI,
  computeCOA,
  computePOA,
  computePIA,
  computeRBTA,
  computeDA,
  computeMAA,
  computeQTA,
  computeMC,
  computeMCS,
  computeLOTS,
  computeHOTS,
  computeCBR,
  computeSCI,
  computeMII,
  computeBDI,
  computeCVI,
  computeMCAI,
  computeDBI,
  computeQCQI,
  computeCAI,
  computeAMI,
  computeFRI,
  computeQPQI,
  computeOCI,
  MetricEngine,
} from "@/lib/uaf/metric-engine";
import type { RawBankData, ExtractedQuestionData } from "@/lib/uaf/types";
import type { MetricResult } from "@/lib/uaf/metric-engine";

// ── Helpers ──

function baseQuestion(overrides: Partial<ExtractedQuestionData> = {}): ExtractedQuestionData {
  return {
    questionIndex: 1,
    questionText: "Sample question?",
    marks: 5,
    moduleNumber: 1,
    coMapping: "CO1",
    rbtLevel: "L2",
    difficultyLevel: "MEDIUM",
    questionType: null,
    commandVerb: null,
    coStatus: "VERIFIED",
    rbtStatus: "VERIFIED",
    difficultyStatus: "VERIFIED",
    ...overrides,
  };
}

function makeData(questions: ExtractedQuestionData[], overrides: Partial<RawBankData> = {}): RawBankData {
  return {
    questionBankId: "qb-test",
    subjectName: "Test Subject",
    subjectCode: "TS101",
    totalSlots: questions.length,
    filledSlots: questions.length,
    questions,
    modules: [],
    totalMarks: questions.reduce((s, q) => s + q.marks, 0),
    extractionTimestamp: "2026-06-22T00:00:00Z",
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════
// Classification Matrix
// ══════════════════════════════════════════════════════════

describe("classifyIndex", () => {
  it("returns EXEMPLARY for value >= 0.90", () => {
    expect(classifyIndex(1.0)).toBe("EXEMPLARY");
    expect(classifyIndex(0.90)).toBe("EXEMPLARY");
  });

  it("returns HIGHLY_EFFECTIVE for [0.80, 0.90)", () => {
    expect(classifyIndex(0.89)).toBe("HIGHLY_EFFECTIVE");
    expect(classifyIndex(0.80)).toBe("HIGHLY_EFFECTIVE");
  });

  it("returns EFFECTIVE for [0.70, 0.80)", () => {
    expect(classifyIndex(0.79)).toBe("EFFECTIVE");
    expect(classifyIndex(0.70)).toBe("EFFECTIVE");
  });

  it("returns ACCEPTABLE for [0.60, 0.70)", () => {
    expect(classifyIndex(0.69)).toBe("ACCEPTABLE");
    expect(classifyIndex(0.60)).toBe("ACCEPTABLE");
  });

  it("returns NEEDS_IMPROVEMENT for [0.50, 0.60)", () => {
    expect(classifyIndex(0.59)).toBe("NEEDS_IMPROVEMENT");
    expect(classifyIndex(0.50)).toBe("NEEDS_IMPROVEMENT");
  });

  it("returns MAJOR_REVISION_REQUIRED for < 0.50", () => {
    expect(classifyIndex(0.49)).toBe("MAJOR_REVISION_REQUIRED");
    expect(classifyIndex(0.0)).toBe("MAJOR_REVISION_REQUIRED");
  });

  it("returns null for null input", () => {
    expect(classifyIndex(null)).toBeNull();
  });
});

describe("classifyConfidence", () => {
  it("returns VERY_HIGH for >= 0.90", () => {
    expect(classifyConfidence(0.95)).toBe("VERY_HIGH");
    expect(classifyConfidence(0.90)).toBe("VERY_HIGH");
  });

  it("returns HIGH for [0.80, 0.90)", () => {
    expect(classifyConfidence(0.85)).toBe("HIGH");
    expect(classifyConfidence(0.80)).toBe("HIGH");
  });

  it("returns MEDIUM for [0.65, 0.80)", () => {
    expect(classifyConfidence(0.70)).toBe("MEDIUM");
    expect(classifyConfidence(0.65)).toBe("MEDIUM");
  });

  it("returns LOW for [0.50, 0.65)", () => {
    expect(classifyConfidence(0.55)).toBe("LOW");
    expect(classifyConfidence(0.50)).toBe("LOW");
  });

  it("returns VERY_LOW for < 0.50", () => {
    expect(classifyConfidence(0.49)).toBe("VERY_LOW");
    expect(classifyConfidence(0.0)).toBe("VERY_LOW");
  });

  it("returns null for null input", () => {
    expect(classifyConfidence(null)).toBeNull();
  });
});

describe("computeConfidence", () => {
  it("computes score as verified / required", () => {
    const result = computeConfidence(8, 10);
    expect(result.score).toBe(0.8);
    expect(result.percentage).toBe(80);
    expect(result.classification).toBe("HIGH");
  });

  it("clamps to 1.0 when verified > required", () => {
    const result = computeConfidence(15, 10);
    expect(result.score).toBe(1.0);
    expect(result.percentage).toBe(100);
    expect(result.classification).toBe("VERY_HIGH");
  });

  it("returns 0 when required is zero", () => {
    const result = computeConfidence(0, 0);
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.classification).toBe("VERY_LOW");
  });
});

// ══════════════════════════════════════════════════════════
// Group 1: Extraction Metrics
// ══════════════════════════════════════════════════════════

describe("computeECS", () => {
  it("returns 1.00 when all questions have all fields extracted", () => {
    const data = makeData([
      baseQuestion({ marks: 5, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM" }),
      baseQuestion({ questionIndex: 2, marks: 10, coMapping: "CO2", rbtLevel: "L3", difficultyLevel: "HARD" }),
    ]);
    // Each question: 1 (text) + 1 (marks) + 1 (co) + 1 (rbt) + 1 (diff) = 5 out of 7 max
    // 2 questions: 10 / 14 = 0.714...
    const result = computeECS(data);
    expect(result.value).toBeCloseTo(10 / 14, 5);
    expect(result.indexCode).toBe("ECS");
    expect(result.computationOrder).toBe(1);
  });

  it("returns lower value when fields are missing", () => {
    const data = makeData([baseQuestion({ marks: 0, coMapping: null, rbtLevel: null, difficultyLevel: null })]);
    // Only question text: 1 / 7 ≈ 0.143
    const result = computeECS(data);
    expect(result.value).toBeCloseTo(1 / 7, 5);
  });

  it("returns null when there are no questions", () => {
    const data = makeData([]);
    const result = computeECS(data);
    expect(result.value).toBeNull();
  });
});

describe("computeEQI", () => {
  it("returns 1.00 when all question attributes are verified", () => {
    const data = makeData([
      baseQuestion({ coStatus: "VERIFIED", rbtStatus: "VERIFIED", difficultyStatus: "VERIFIED" }),
      baseQuestion({ questionIndex: 2, coStatus: "VERIFIED", rbtStatus: "VERIFIED", difficultyStatus: "VERIFIED" }),
    ]);
    const result = computeEQI(data);
    expect(result.value).toBe(1.0);
    expect(result.indexCode).toBe("EQI");
    expect(result.computationOrder).toBe(2);
  });

  it("returns 0.00 when none are verified", () => {
    const data = makeData([
      baseQuestion({ coStatus: "MISSING_DATA", rbtStatus: "MISSING_DATA", difficultyStatus: "MISSING_DATA" }),
    ]);
    const result = computeEQI(data);
    expect(result.value).toBe(0.0);
  });

  it("returns null for empty questions array", () => {
    const data = makeData([]);
    const result = computeEQI(data);
    expect(result.value).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// Group 2: MII Sub-metrics
// ══════════════════════════════════════════════════════════

describe("computeCOA", () => {
  it("returns 1.00 when all questions have CO mapping", () => {
    const data = makeData([baseQuestion({ coMapping: "CO1" }), baseQuestion({ questionIndex: 2, coMapping: "CO2" })]);
    expect(computeCOA(data).value).toBe(1.0);
  });

  it("returns 0.00 when no questions have CO mapping", () => {
    const data = makeData([baseQuestion({ coMapping: null })]);
    expect(computeCOA(data).value).toBe(0.0);
  });

  it("returns null for empty questions array", () => {
    expect(computeCOA(makeData([])).value).toBeNull();
  });
});

describe("computePOA", () => {
  it("returns null because PO mapping is unavailable", () => {
    const result = computePOA(makeData([baseQuestion()]));
    expect(result.value).toBeNull();
    expect(result.weight).toBeCloseTo(1 / 9, 5);
    expect(result.computationOrder).toBe(4);
  });
});

describe("computePIA", () => {
  it("returns null because PI mapping is unavailable", () => {
    const result = computePIA(makeData([baseQuestion()]));
    expect(result.value).toBeNull();
    expect(result.weight).toBeCloseTo(1 / 9, 5);
    expect(result.computationOrder).toBe(5);
  });
});

describe("computeRBTA", () => {
  it("returns 1.00 when all RBT statuses are VERIFIED", () => {
    const data = makeData([baseQuestion({ rbtStatus: "VERIFIED" }), baseQuestion({ questionIndex: 2, rbtStatus: "VERIFIED" })]);
    expect(computeRBTA(data).value).toBe(1.0);
  });

  it("returns 0.00 when none are VERIFIED", () => {
    const data = makeData([baseQuestion({ rbtStatus: "MISSING_DATA" })]);
    expect(computeRBTA(data).value).toBe(0.0);
  });

  it("returns null for empty questions", () => {
    expect(computeRBTA(makeData([])).value).toBeNull();
  });
});

describe("computeDA", () => {
  it("returns 1.00 when all difficulty statuses are VERIFIED", () => {
    const data = makeData([baseQuestion({ difficultyStatus: "VERIFIED" })]);
    expect(computeDA(data).value).toBe(1.0);
  });

  it("returns 0.00 when none are VERIFIED", () => {
    const data = makeData([baseQuestion({ difficultyStatus: "UNABLE_TO_VERIFY" })]);
    expect(computeDA(data).value).toBe(0.0);
  });

  it("returns null for empty questions", () => {
    expect(computeDA(makeData([])).value).toBeNull();
  });
});

describe("computeMAA", () => {
  it("returns 1.00 when all questions have marks > 0", () => {
    const data = makeData([baseQuestion({ marks: 5 }), baseQuestion({ questionIndex: 2, marks: 10 })]);
    expect(computeMAA(data).value).toBe(1.0);
  });

  it("returns 0.00 when all marks are 0", () => {
    const data = makeData([baseQuestion({ marks: 0 })]);
    expect(computeMAA(data).value).toBe(0.0);
  });

  it("returns null for empty questions", () => {
    expect(computeMAA(makeData([])).value).toBeNull();
  });
});

describe("computeQTA", () => {
  it("returns null because question type classification is unavailable", () => {
    const result = computeQTA(makeData([baseQuestion()]));
    expect(result.value).toBeNull();
  });
});

describe("computeMC", () => {
  it("returns 1.00 when all questions have CO, RBT, and Difficulty", () => {
    const data = makeData([
      baseQuestion({ coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM" }),
    ]);
    // available = 3, totalPossible = 3
    expect(computeMC(data).value).toBe(1.0);
  });

  it("returns lower value when metadata fields are missing", () => {
    const data = makeData([
      baseQuestion({ coMapping: "CO1", rbtLevel: null, difficultyLevel: null }),
    ]);
    // available = 1, totalPossible = 3
    expect(computeMC(data).value).toBeCloseTo(1 / 3, 5);
  });

  it("returns null for empty questions", () => {
    expect(computeMC(makeData([])).value).toBeNull();
  });
});

describe("computeMCS", () => {
  it("always returns 1.00 (full consistency assumed)", () => {
    const result = computeMCS(makeData([baseQuestion()]));
    expect(result.value).toBe(1.0);
    expect(result.classification).toBe("EXEMPLARY");
  });
});

// ══════════════════════════════════════════════════════════
// Group 3: Bloom Sub-metrics
// ══════════════════════════════════════════════════════════

describe("computeLOTS", () => {
  it("counts L1-L3 as LOTS", () => {
    const data = makeData([
      baseQuestion({ rbtLevel: "L1" }),
      baseQuestion({ questionIndex: 2, rbtLevel: "L2" }),
      baseQuestion({ questionIndex: 3, rbtLevel: "L4" }),
    ]);
    expect(computeLOTS(data).value).toBeCloseTo(2 / 3, 5);
  });

  it("returns 0 when no LOTS questions", () => {
    const data = makeData([baseQuestion({ rbtLevel: "L4" })]);
    expect(computeLOTS(data).value).toBe(0.0);
  });

  it("returns null for empty questions", () => {
    expect(computeLOTS(makeData([])).value).toBeNull();
  });
});

describe("computeHOTS", () => {
  it("counts L4-L6 as HOTS", () => {
    const data = makeData([
      baseQuestion({ rbtLevel: "L4" }),
      baseQuestion({ questionIndex: 2, rbtLevel: "L5" }),
      baseQuestion({ questionIndex: 3, rbtLevel: "L1" }),
    ]);
    expect(computeHOTS(data).value).toBeCloseTo(2 / 3, 5);
  });

  it("returns 0 when no HOTS questions", () => {
    const data = makeData([baseQuestion({ rbtLevel: "L1" })]);
    expect(computeHOTS(data).value).toBe(0.0);
  });

  it("returns null for empty questions", () => {
    expect(computeHOTS(makeData([])).value).toBeNull();
  });
});

describe("computeCBR", () => {
  it("computes hots / lots ratio", () => {
    const lots = { value: 0.6 } as MetricResult;
    const hots = { value: 0.4 } as MetricResult;
    const data = makeData([]);
    const result = computeCBR(data, lots, hots);
    expect(result.value).toBeCloseTo(0.4 / 0.6, 5);
    expect(result.computationOrder).toBe(14);
  });

  it("returns null when lots is 0 (division by zero)", () => {
    const lots = { value: 0 } as MetricResult;
    const hots = { value: 0.5 } as MetricResult;
    const data = makeData([]);
    const result = computeCBR(data, lots, hots);
    expect(result.value).toBeNull();
  });

  it("returns null when lots is null", () => {
    const lots = { value: null } as MetricResult;
    const hots = { value: 0.5 } as MetricResult;
    const data = makeData([]);
    const result = computeCBR(data, lots, hots);
    expect(result.value).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// Group 4: Core Indices
// ══════════════════════════════════════════════════════════

describe("computeSCI", () => {
  it("returns filledSlots / totalSlots", () => {
    const data = makeData([baseQuestion()], { totalSlots: 10, filledSlots: 7 });
    expect(computeSCI(data).value).toBeCloseTo(0.7, 5);
  });

  it("returns 0 when totalSlots is 0", () => {
    const data = makeData([], { totalSlots: 0, filledSlots: 0 });
    expect(computeSCI(data).value).toBe(0);
  });

  it("clamps to 1 when filledSlots > totalSlots", () => {
    const data = makeData([], { totalSlots: 5, filledSlots: 99 });
    expect(computeSCI(data).value).toBe(1.0);
  });
});

describe("computeMII", () => {
  it("averages all 9 sub-metrics, treating null as 0", () => {
    // Provide all 9 sub-metrics with varying values
    const results: MetricResult[] = [
      { indexCode: "COA", value: 1.0 } as MetricResult,
      { indexCode: "POA", value: null } as MetricResult,
      { indexCode: "PIA", value: null } as MetricResult,
      { indexCode: "RBTA", value: 0.8 } as MetricResult,
      { indexCode: "DA", value: 0.8 } as MetricResult,
      { indexCode: "MAA", value: 1.0 } as MetricResult,
      { indexCode: "QTA", value: null } as MetricResult,
      { indexCode: "MC", value: 1.0 } as MetricResult,
      { indexCode: "MCS", value: 1.0 } as MetricResult,
    ];
    const result = computeMII(results);
    // Sum = 1.0 + 0 + 0 + 0.8 + 0.8 + 1.0 + 0 + 1.0 + 1.0 = 5.6
    // Average = 5.6 / 9 ≈ 0.622
    expect(result.value).toBeCloseTo(5.6 / 9, 5);
  });

  it("returns null when no sub-metrics are found", () => {
    const result = computeMII([]);
    expect(result.value).toBeNull();
  });

  it("returns 0 when all 9 sub-metrics have null values", () => {
    const results: MetricResult[] = [
      { indexCode: "COA", value: null } as MetricResult,
      { indexCode: "POA", value: null } as MetricResult,
      { indexCode: "PIA", value: null } as MetricResult,
      { indexCode: "RBTA", value: null } as MetricResult,
      { indexCode: "DA", value: null } as MetricResult,
      { indexCode: "MAA", value: null } as MetricResult,
      { indexCode: "QTA", value: null } as MetricResult,
      { indexCode: "MC", value: null } as MetricResult,
      { indexCode: "MCS", value: null } as MetricResult,
    ];
    const result = computeMII(results);
    // All nulls treated as 0 → 0 / 9 = 0
    expect(result.value).toBe(0);
  });
});

describe("computeBDI", () => {
  it("returns 1.00 for perfectly uniform Bloom distribution", () => {
    // 6 questions, one per Bloom level
    const data = makeData([
      baseQuestion({ rbtLevel: "L1" }),
      baseQuestion({ questionIndex: 2, rbtLevel: "L2" }),
      baseQuestion({ questionIndex: 3, rbtLevel: "L3" }),
      baseQuestion({ questionIndex: 4, rbtLevel: "L4" }),
      baseQuestion({ questionIndex: 5, rbtLevel: "L5" }),
      baseQuestion({ questionIndex: 6, rbtLevel: "L6" }),
    ]);
    // deviation = 0, so BDI = 1 - 0/2 = 1.0
    const result = computeBDI(data);
    expect(result.value).toBe(1.0);
  });

  it("returns lower value when all questions are on the same level", () => {
    const data = makeData([
      baseQuestion({ rbtLevel: "L2" }),
      baseQuestion({ questionIndex: 2, rbtLevel: "L2" }),
      baseQuestion({ questionIndex: 3, rbtLevel: "L2" }),
    ]);
    const result = computeBDI(data);
    // deviation = |1 - 1/6| + |0 - 1/6| + ... for 6 bins
    // = 5/6 + 1/6 + 1/6 + 1/6 + 1/6 + 1/6 = 10/6 = 1.666...
    // BDI = 1 - 1.666.../2 = 1 - 0.833... = 0.166...
    expect(result.value).toBeGreaterThan(0);
    expect(result.value).toBeLessThan(0.5);
  });

  it("handles empty questions array", () => {
    const data = makeData([]);
    const result = computeBDI(data);
    // deviation = 0, BDI = 1.0
    expect(result.value).toBe(1.0);
  });
});

describe("computeCVI", () => {
  it("returns 1.00 when all 6 COs are covered", () => {
    const data = makeData([
      baseQuestion({ coMapping: "CO1" }),
      baseQuestion({ questionIndex: 2, coMapping: "CO2" }),
      baseQuestion({ questionIndex: 3, coMapping: "CO3" }),
      baseQuestion({ questionIndex: 4, coMapping: "CO4" }),
      baseQuestion({ questionIndex: 5, coMapping: "CO5" }),
      baseQuestion({ questionIndex: 6, coMapping: "CO6" }),
    ]);
    expect(computeCVI(data).value).toBe(1.0);
  });

  it("returns 0.50 when only 3 of 6 COs are covered", () => {
    const data = makeData([
      baseQuestion({ coMapping: "CO1" }),
      baseQuestion({ questionIndex: 2, coMapping: "CO2" }),
      baseQuestion({ questionIndex: 3, coMapping: "CO3" }),
      baseQuestion({ questionIndex: 4, coMapping: "CO1" }),
    ]);
    // Unique COs = {CO1, CO2, CO3} → 3 / 6 = 0.50
    expect(computeCVI(data).value).toBe(0.5);
  });

  it("returns 0 when no questions have CO mapping", () => {
    const data = makeData([baseQuestion({ coMapping: null })]);
    expect(computeCVI(data).value).toBe(0);
  });
});

describe("computeMCAI", () => {
  it("returns 1.00 when all questions are marks-RBT aligned", () => {
    // 2 marks → L1/L2 allowed → L2 is aligned
    const data = makeData([baseQuestion({ marks: 2, rbtLevel: "L1" })]);
    expect(computeMCAI(data).value).toBe(1.0);
  });

  it("returns 0.00 when no questions are aligned", () => {
    // 15 marks should be L5/L6, but we set L1
    const data = makeData([baseQuestion({ marks: 15, rbtLevel: "L1" })]);
    expect(computeMCAI(data).value).toBe(0.0);
  });

  it("returns null when there are no questions", () => {
    expect(computeMCAI(makeData([])).value).toBeNull();
  });
});

describe("computeDBI", () => {
  it("returns 1.00 when difficulty distribution matches expected (30/50/20)", () => {
    // 10 questions: 3 Easy, 5 Medium, 2 Hard → exactly 30/50/20
    const data = makeData([
      baseQuestion({ difficultyLevel: "EASY" }),
      baseQuestion({ questionIndex: 2, difficultyLevel: "EASY" }),
      baseQuestion({ questionIndex: 3, difficultyLevel: "EASY" }),
      baseQuestion({ questionIndex: 4, difficultyLevel: "MEDIUM" }),
      baseQuestion({ questionIndex: 5, difficultyLevel: "MEDIUM" }),
      baseQuestion({ questionIndex: 6, difficultyLevel: "MEDIUM" }),
      baseQuestion({ questionIndex: 7, difficultyLevel: "MEDIUM" }),
      baseQuestion({ questionIndex: 8, difficultyLevel: "MEDIUM" }),
      baseQuestion({ questionIndex: 9, difficultyLevel: "HARD" }),
      baseQuestion({ questionIndex: 10, difficultyLevel: "HARD" }),
    ]);
    expect(computeDBI(data).value).toBe(1.0);
  });

  it("returns lower value when all questions are HARD", () => {
    const data = makeData([
      baseQuestion({ difficultyLevel: "HARD" }),
      baseQuestion({ questionIndex: 2, difficultyLevel: "HARD" }),
    ]);
    // Expected: Easy=0.3, Medium=0.5, Hard=0.2
    // Observed: 0, 0, 1.0
    // Deviation = |0-0.3| + |0-0.5| + |1.0-0.2| = 0.3 + 0.5 + 0.8 = 1.6
    // DBI = 1 - 1.6/2 = 1 - 0.8 = 0.2
    expect(computeDBI(data).value).toBeCloseTo(0.2, 5);
  });

  it("returns null for empty questions array", () => {
    expect(computeDBI(makeData([])).value).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// Group 5: Quality Indices
// ══════════════════════════════════════════════════════════

describe("computeQCQI", () => {
  it("returns null because it requires AI/human evaluation", () => {
    const result = computeQCQI();
    expect(result.value).toBeNull();
    expect(result.weight).toBe(0.15);
    expect(result.computationOrder).toBe(21);
  });
});

describe("computeCAI", () => {
  it("returns 1.00 when all questions have both CO and RBT", () => {
    const data = makeData([
      baseQuestion({ coMapping: "CO1", rbtLevel: "L2" }),
      baseQuestion({ questionIndex: 2, coMapping: "CO2", rbtLevel: "L3" }),
    ]);
    expect(computeCAI(data).value).toBe(1.0);
  });

  it("returns 0.00 when no questions have both CO and RBT", () => {
    const data = makeData([baseQuestion({ coMapping: null, rbtLevel: null })]);
    expect(computeCAI(data).value).toBe(0.0);
  });

  it("returns null for empty questions array", () => {
    expect(computeCAI(makeData([])).value).toBeNull();
  });
});

describe("computeAMI", () => {
  it("returns null because moderation criteria are unavailable", () => {
    const result = computeAMI();
    expect(result.value).toBeNull();
    expect(result.weight).toBe(0.05);
    expect(result.computationOrder).toBe(23);
  });
});

describe("computeFRI", () => {
  it("returns null because future readiness criteria are unavailable", () => {
    const result = computeFRI();
    expect(result.value).toBeNull();
    expect(result.weight).toBe(0.05);
    expect(result.computationOrder).toBe(24);
  });
});

// ══════════════════════════════════════════════════════════
// Group 6: Composite Indices
// ══════════════════════════════════════════════════════════

describe("computeQPQI", () => {
  it("computes weighted composite from available metric results", () => {
    // Provide all 10 weighted metrics at perfect 1.0 value
    const results: MetricResult[] = [
      { indexCode: "SCI", value: 1.0, weight: 0.10 } as MetricResult,
      { indexCode: "MII", value: 1.0, weight: 0.10 } as MetricResult,
      { indexCode: "BDI", value: 1.0, weight: 0.15 } as MetricResult,
      { indexCode: "CVI", value: 1.0, weight: 0.10 } as MetricResult,
      { indexCode: "MCAI", value: 1.0, weight: 0.10 } as MetricResult,
      { indexCode: "DBI", value: 1.0, weight: 0.10 } as MetricResult,
      { indexCode: "QCQI", value: 1.0, weight: 0.15 } as MetricResult,
      { indexCode: "CAI", value: 1.0, weight: 0.10 } as MetricResult,
      { indexCode: "AMI", value: 1.0, weight: 0.05 } as MetricResult,
      { indexCode: "FRI", value: 1.0, weight: 0.05 } as MetricResult,
    ];
    const result = computeQPQI(results);
    // All weights sum to 1.0, all values = 1.0 → QPQI = 1.0
    expect(result.value).toBe(1.0);
    expect(result.computationOrder).toBe(25);
  });

  it("skips null-valued metrics when computing weighted sum", () => {
    const results: MetricResult[] = [
      { indexCode: "SCI", value: 1.0, weight: 0.10 } as MetricResult,
      { indexCode: "QCQI", value: null, weight: 0.15 } as MetricResult,
      { indexCode: "CAI", value: 1.0, weight: 0.10 } as MetricResult,
    ];
    const result = computeQPQI(results);
    // Only SCI and CAI have values: (1.0*0.10 + 1.0*0.10) / (0.10+0.10) = 0.20/0.20 = 1.0
    expect(result.value).toBe(1.0);
  });

  it("returns null when no weighted metrics have values", () => {
    const results: MetricResult[] = [
      { indexCode: "QCQI", value: null, weight: 0.15 } as MetricResult,
      { indexCode: "ECS", value: 0.5, classification: null, weight: null, computationOrder: 0, formulaUsed: "" } as MetricResult,
    ];
    const result = computeQPQI(results);
    expect(result.value).toBeNull();
  });
});

describe("computeOCI", () => {
  it("computes mean of all available metric values", () => {
    const results: MetricResult[] = [
      { indexCode: "ECS", value: 0.8 } as MetricResult,
      { indexCode: "EQI", value: 0.6 } as MetricResult,
      { indexCode: "COA", value: null } as MetricResult,
    ];
    const result = computeOCI(results);
    // (0.8 + 0.6) / 2 = 0.7
    expect(result.value).toBeCloseTo(0.7, 5);
    expect(result.computationOrder).toBe(26);
  });

  it("returns null when no metrics have values", () => {
    const results: MetricResult[] = [
      { indexCode: "POA", value: null } as MetricResult,
    ];
    const result = computeOCI(results);
    expect(result.value).toBeNull();
  });

  it("returns single metric value when only one metric is available", () => {
    const results: MetricResult[] = [
      { indexCode: "ECS", value: 0.85 } as MetricResult,
    ];
    const result = computeOCI(results);
    expect(result.value).toBeCloseTo(0.85, 5);
  });
});

// ══════════════════════════════════════════════════════════
// MetricEngine Integration
// ══════════════════════════════════════════════════════════

describe("MetricEngine.computeAll", () => {
  const engine = new MetricEngine();

  it("returns 26 results covering all index codes with unique computation orders", () => {
    const data = makeData([
      baseQuestion({ coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM" }),
      baseQuestion({ questionIndex: 2, coMapping: "CO2", rbtLevel: "L3", difficultyLevel: "HARD" }),
    ]);
    const results = engine.computeAll(data);

    expect(results).toHaveLength(26);
    const codes = results.map((r) => r.indexCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(26);

    const orders = results.map((r) => r.computationOrder);
    const uniqueOrders = new Set(orders);
    expect(uniqueOrders.size).toBe(26);
    expect(Math.min(...orders)).toBe(1);
    expect(Math.max(...orders)).toBe(26);
    // Results after composites must have been computed
    expect(results[results.length - 2].indexCode).toBe("QPQI");
    expect(results[results.length - 1].indexCode).toBe("OCI");
  });

  it("computes all index codes", () => {
    const data = makeData([
      baseQuestion({ coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM" }),
      baseQuestion({ questionIndex: 2, coMapping: "CO2", rbtLevel: "L3", difficultyLevel: "HARD" }),
    ]);
    const results = engine.computeAll(data);
    const codes = results.map((r) => r.indexCode);
    const expectedCodes = [
      "ECS", "EQI",
      "COA", "POA", "PIA", "RBTA", "DA", "MAA", "QTA", "MC", "MCS",
      "LOTS", "HOTS", "CBR",
      "SCI", "CVI", "MCAI", "DBI",
      "MII", "BDI",
      "QCQI", "CAI", "AMI", "FRI",
      "QPQI", "OCI",
    ];
    expect(codes).toEqual(expectedCodes);
  });

  it("QPQI and OCI are computed after all component metrics", () => {
    const data = makeData([baseQuestion()]);
    const results = engine.computeAll(data);
    // Last two results must be QPQI and OCI
    expect(results[24].indexCode).toBe("QPQI");
    expect(results[25].indexCode).toBe("OCI");
  });

  it("handles empty question bank gracefully", () => {
    const data = makeData([]);
    const results = engine.computeAll(data);
    expect(results).toHaveLength(26);
    // ECS and EQI should be null with no questions
    expect(results.find((r) => r.indexCode === "ECS")!.value).toBeNull();
    expect(results.find((r) => r.indexCode === "EQI")!.value).toBeNull();
    // SCI should be 0 with no filled slots
    expect(results.find((r) => r.indexCode === "SCI")!.value).toBe(0);
    // QPQI should still compute (may be null if no weighted values)
    expect(results.find((r) => r.indexCode === "QPQI")).toBeDefined();
    expect(results.find((r) => r.indexCode === "OCI")).toBeDefined();
  });
});
