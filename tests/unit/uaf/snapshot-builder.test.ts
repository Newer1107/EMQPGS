import { describe, it, expect } from "vitest";
import { SnapshotBuilder } from "@/lib/uaf/snapshot-builder";
import type { RawBankData, MetricResult } from "@/lib/uaf/types";

function makeMockData(overrides?: Partial<RawBankData>): RawBankData {
  return {
    questionBankId: "qb-1",
    subjectName: "Data Structures",
    subjectCode: "CS301",
    totalSlots: 42,
    filledSlots: 10,
    totalMarks: 100,
    extractionTimestamp: "2026-06-22T00:00:00.000Z",
    marksOptions: [2, 5, 10],
    questions: [
      {
        questionIndex: 1,
        questionText: "Define array?",
        marks: 2,
        moduleNumber: 1,
        coMapping: "CO1",
        rbtLevel: "REMEMBER",
        difficultyLevel: "EASY",
        questionType: null,
        commandVerb: "define",
        coStatus: "VERIFIED",
        rbtStatus: "VERIFIED",
        difficultyStatus: "VERIFIED",
        questionStatus: null,
        clarityScore: 0,
      },
      {
        questionIndex: 2,
        questionText: "Explain linked list?",
        marks: 5,
        moduleNumber: 1,
        coMapping: "CO2",
        rbtLevel: "UNDERSTAND",
        difficultyLevel: "MEDIUM",
        questionType: null,
        commandVerb: "explain",
        coStatus: "VERIFIED",
        rbtStatus: "UNABLE_TO_VERIFY",
        difficultyStatus: "VERIFIED",
        questionStatus: null,
        clarityScore: 0,
      },
      {
        questionIndex: 3,
        questionText: "Design a stack?",
        marks: 10,
        moduleNumber: 2,
        coMapping: null,
        rbtLevel: null,
        difficultyLevel: null,
        questionType: null,
        commandVerb: "design",
        coStatus: "MISSING_DATA",
        rbtStatus: "MISSING_DATA",
        difficultyStatus: "MISSING_DATA",
        questionStatus: null,
        clarityScore: 0,
      },
      {
        questionIndex: 4,
        questionText: "Compare sorting?",
        marks: 5,
        moduleNumber: 2,
        coMapping: "CO3",
        rbtLevel: "ANALYZE",
        difficultyLevel: "HARD",
        questionType: null,
        commandVerb: "compare",
        coStatus: "UNABLE_TO_VERIFY",
        rbtStatus: "VERIFIED",
        difficultyStatus: "UNABLE_TO_VERIFY",
        questionStatus: null,
        clarityScore: 0,
      },
    ],
    modules: [
      { moduleNumber: 1, totalQuestions: 2, totalMarks: 7, coveredCOs: ["CO1", "CO2"] },
      { moduleNumber: 2, totalQuestions: 2, totalMarks: 15, coveredCOs: ["CO3"] },
    ],
    ...overrides,
  };
}

function makeMockMetrics(overrides?: Partial<MetricResult[]>): MetricResult[] {
  return [
    { indexCode: "ECS", value: 0.75, classification: "EFFECTIVE" },
    { indexCode: "EQI", value: 0.82, classification: "HIGHLY_EFFECTIVE" },
    { indexCode: "BDI", value: 0.45, classification: "NEEDS_IMPROVEMENT" },
    { indexCode: "LOTS", value: 0.6, classification: "EFFECTIVE" },
    { indexCode: "HOTS", value: 0.4, classification: "NEEDS_IMPROVEMENT" },
    { indexCode: "CBR", value: 0.5, classification: "EFFECTIVE" },
    { indexCode: "DBI", value: null, classification: null },
  ] ?? overrides;
}

describe("SnapshotBuilder", () => {
  const builder = new SnapshotBuilder();

  describe("build()", () => {
    it("returns correct EvidenceSnapshotData shape", () => {
      const data = makeMockData();
      const metrics = makeMockMetrics();
      const snapshot = builder.build(data, metrics);

      expect(snapshot).toHaveProperty("totalQuestions");
      expect(snapshot).toHaveProperty("verifiedQuestions");
      expect(snapshot).toHaveProperty("unableToVerifyQuestions");
      expect(snapshot).toHaveProperty("missingDataQuestions");
      expect(snapshot).toHaveProperty("extractionCompletenessScore");
      expect(snapshot).toHaveProperty("extractionQualityIndex");
      expect(snapshot).toHaveProperty("metrics");
      expect(snapshot).toHaveProperty("distributions");
      expect(snapshot).toHaveProperty("detectedRisks");
      expect(snapshot).toHaveProperty("outlierLists");
      expect(snapshot).toHaveProperty("supportingEvidence");
      expect(snapshot).toHaveProperty("representativeExamples");
    });

    it("counts questions correctly across status categories", () => {
      const data = makeMockData();
      const metrics = makeMockMetrics();
      const snapshot = builder.build(data, metrics);

      expect(snapshot.totalQuestions).toBe(4);
      // Q1 (co=VERIFIED), Q2 (co=VERIFIED), Q4 (rbt=VERIFIED)
      expect(snapshot.verifiedQuestions).toBe(3);
      // Question 4 has coStatus=UNABLE_TO_VERIFY
      expect(snapshot.unableToVerifyQuestions).toBe(1);
      // Question 3 has coStatus=MISSING_DATA
      expect(snapshot.missingDataQuestions).toBe(1);
    });

    it("maps metric values by indexCode", () => {
      const data = makeMockData();
      const metrics = makeMockMetrics();
      const snapshot = builder.build(data, metrics);

      expect(snapshot.metrics["ECS"]).toBe(0.75);
      expect(snapshot.metrics["EQI"]).toBe(0.82);
      expect(snapshot.metrics["BDI"]).toBe(0.45);
      expect(snapshot.metrics["DBI"]).toBeNull();
    });

    it("sets extractionCompletenessScore and extractionQualityIndex from metrics", () => {
      const data = makeMockData();
      const metrics = makeMockMetrics();
      const snapshot = builder.build(data, metrics);

      expect(snapshot.extractionCompletenessScore).toBe(0.75);
      expect(snapshot.extractionQualityIndex).toBe(0.82);
    });

    it("sets nullable fields to null when no data", () => {
      const data = makeMockData();
      const snapshot = builder.build(data, []);

      expect(snapshot.extractionCompletenessScore).toBeNull();
      expect(snapshot.extractionQualityIndex).toBeNull();
      expect(snapshot.metrics).toEqual({});
    });
  });

  describe("distributions", () => {
    it("builds bloom distribution from rbtLevel values", () => {
      const data = makeMockData();
      const snapshot = builder.build(data, makeMockMetrics());

      expect(snapshot.distributions.bloom).toEqual({
        REMEMBER: 1,
        UNDERSTAND: 1,
        ANALYZE: 1,
      });
    });

    it("builds difficulty distribution", () => {
      const data = makeMockData();
      const snapshot = builder.build(data, makeMockMetrics());

      expect(snapshot.distributions.difficulty).toEqual({
        EASY: 1,
        MEDIUM: 1,
        HARD: 1,
      });
    });

    it("builds coCoverage distribution", () => {
      const data = makeMockData();
      const snapshot = builder.build(data, makeMockMetrics());

      expect(snapshot.distributions.coCoverage).toEqual({
        CO1: 1,
        CO2: 1,
        CO3: 1,
      });
    });

    it("builds moduleCoverage distribution with Module prefix", () => {
      const data = makeMockData();
      const snapshot = builder.build(data, makeMockMetrics());

      expect(snapshot.distributions.moduleCoverage).toEqual({
        "Module 1": 2,
        "Module 2": 2,
      });
    });

    it("excludes null values from distributions", () => {
      const data = makeMockData();
      const snapshot = builder.build(data, makeMockMetrics());

      // Question 3 has null rbtLevel, difficultyLevel, coMapping
      // So they don't appear in distributions
      expect(Object.keys(snapshot.distributions.bloom).length).toBe(3);
      expect(Object.keys(snapshot.distributions.difficulty).length).toBe(3);
      expect(Object.keys(snapshot.distributions.coCoverage).length).toBe(3);
    });
  });

  describe("detectRisks()", () => {
    it("flags null metric values as 'unable to compute'", () => {
      const metrics: MetricResult[] = [
        { indexCode: "DBI", value: null, classification: null },
      ];
      // Access via build which calls detectRisks internally
      const data = makeMockData();
      const snapshot = builder.build(data, metrics);

      expect(snapshot.detectedRisks).toContain("DBI: unable to compute");
    });

    it("flags metric values below 0.50", () => {
      const metrics: MetricResult[] = [
        { indexCode: "BDI", value: 0.45, classification: "NEEDS_IMPROVEMENT" },
      ];
      const data = makeMockData();
      const snapshot = builder.build(data, metrics);

      expect(snapshot.detectedRisks).toContain("BDI: NEEDS_IMPROVEMENT (0.45)");
    });

    it("does not flag metrics at exactly 0.50", () => {
      const metrics: MetricResult[] = [
        { indexCode: "CBR", value: 0.5, classification: "EFFECTIVE" },
      ];
      const data = makeMockData();
      const snapshot = builder.build(data, metrics);

      expect(snapshot.detectedRisks).not.toContain("CBR");
    });

    it("does not flag metrics above 0.50", () => {
      const metrics: MetricResult[] = [
        { indexCode: "ECS", value: 0.75, classification: "EFFECTIVE" },
      ];
      const data = makeMockData();
      const snapshot = builder.build(data, metrics);

      expect(snapshot.detectedRisks).toEqual([]);
    });
  });

  describe("computeEvidenceHash()", () => {
    const snapshot = {
      totalQuestions: 4,
      verifiedQuestions: 2,
      unableToVerifyQuestions: 1,
      missingDataQuestions: 1,
      extractionCompletenessScore: 0.75,
      extractionQualityIndex: 0.82,
      metrics: { ECS: 0.75, EQI: 0.82 },
      distributions: {
        bloom: { REMEMBER: 1, UNDERSTAND: 1, ANALYZE: 1 },
        difficulty: { EASY: 1, MEDIUM: 1, HARD: 1 },
        coCoverage: { CO1: 1, CO2: 1, CO3: 1 },
        moduleCoverage: { "Module 1": 2, "Module 2": 2 },
        marksDistribution: {},
        questionTypeDistribution: {},
        questionStatusDistribution: {},
        moduleMarks: {},
      },
      detectedRisks: ["BDI: NEEDS_IMPROVEMENT (0.45)"],
      outlierLists: [],
      supportingEvidence: {},
      representativeExamples: {},
    };

    it("is deterministic — same input produces same hash", () => {
      const hash1 = builder.computeEvidenceHash(snapshot, "1.0.0", "v1");
      const hash2 = builder.computeEvidenceHash(snapshot, "1.0.0", "v1");
      expect(hash1).toBe(hash2);
    });

    it("changes when engine version differs", () => {
      const hash1 = builder.computeEvidenceHash(snapshot, "1.0.0", "v1");
      const hash2 = builder.computeEvidenceHash(snapshot, "2.0.0", "v1");
      expect(hash1).not.toBe(hash2);
    });

    it("changes when prompt version differs", () => {
      const hash1 = builder.computeEvidenceHash(snapshot, "1.0.0", "v1");
      const hash2 = builder.computeEvidenceHash(snapshot, "1.0.0", "v2");
      expect(hash1).not.toBe(hash2);
    });

    it("changes when snapshot content differs", () => {
      const modified = { ...snapshot, totalQuestions: 5 };
      const hash1 = builder.computeEvidenceHash(snapshot, "1.0.0", "v1");
      const hash2 = builder.computeEvidenceHash(modified, "1.0.0", "v1");
      expect(hash1).not.toBe(hash2);
    });

    it("returns a 64-character hex string", () => {
      const hash = builder.computeEvidenceHash(snapshot, "1.0.0", "v1");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
