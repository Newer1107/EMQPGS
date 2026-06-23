import { describe, it, expect } from "vitest";
import { EvaluationEngine } from "@/lib/evaluation/evaluation-engine";
import type { EvaluationBankData, EvaluationQuestion } from "@/lib/evaluation/types";

function makeQuestion(overrides: Partial<EvaluationQuestion> & { moduleNumber: number }): EvaluationQuestion {
  const defaults = {
    slotId: `slot-${overrides.moduleNumber}-${Math.random().toString(36).slice(2, 6)}`,
    moduleNumber: overrides.moduleNumber,
    marks: 5,
    slotNumber: 1,
    questionText: "Define the term?",
    coMapping: "CO1",
    rbtLevel: "L1",
    difficultyLevel: "MEDIUM",
    questionStatus: "APPROVED",
    isLocked: false,
  };
  // Only override keys that are explicitly provided (not undefined), respecting explicit null
  const result = { ...defaults };
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== undefined) {
      (result as any)[key] = val;
    }
  }
  return result as EvaluationQuestion;
}

function makeBankData(questions: EvaluationQuestion[]): EvaluationBankData {
  const modules = [...new Set(questions.map((q) => q.moduleNumber))].sort((a, b) => a - b);
  const marks = [...new Set(questions.map((q) => q.marks))].sort((a, b) => a - b);
  return {
    questionBankId: "test-bank-1",
    subjectName: "Test Subject",
    subjectCode: "TS101",
    batchName: "Test Batch",
    semesterNumber: 3,
    academicYearCode: "2025-26",
    departmentName: "Test Department",
    totalSlots: 42,
    filledSlots: questions.length,
    questions,
    modules,
    marksOptions: marks,
  };
}

describe("EvaluationEngine", () => {
  const engine = new EvaluationEngine();

  // ── Module Summary ──────────────────────────────────────────

  it("computes module summary with correct counts", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, marks: 2, coMapping: "CO1" }),
      makeQuestion({ moduleNumber: 1, marks: 5, coMapping: "CO1" }),
      makeQuestion({ moduleNumber: 2, marks: 10, coMapping: "CO2" }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.moduleSummary).toHaveLength(2);
    expect(result.moduleSummary[0]).toMatchObject({ moduleNumber: 1, filledSlots: 2, totalMarks: 7 });
    expect(result.moduleSummary[1]).toMatchObject({ moduleNumber: 2, filledSlots: 1, totalMarks: 10 });
  });

  it("identifies CO articulation per module", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, coMapping: "CO1" }),
      makeQuestion({ moduleNumber: 1, coMapping: "CO2" }),
      makeQuestion({ moduleNumber: 1, coMapping: "CO1" }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.moduleSummary[0].articulation).toContain("CO1");
    expect(result.moduleSummary[0].articulation).toContain("CO2");
  });

  // ── Attribute Completeness ───────────────────────────────────

  it("computes 100% completeness when all attributes present", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "EASY", marks: 2 }),
      makeQuestion({ moduleNumber: 1, coMapping: "CO2", rbtLevel: "L3", difficultyLevel: "MEDIUM", marks: 5 }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.attributeCompleteness[0].completenessPct).toBe(100);
    expect(result.overallCompletenessPct).toBe(100);
  });

  it("detects missing attributes", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, coMapping: null, rbtLevel: "L2", difficultyLevel: "EASY", marks: 2 }),
      makeQuestion({ moduleNumber: 1, coMapping: "CO2", rbtLevel: null, difficultyLevel: null, marks: 5 }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    const m1 = result.attributeCompleteness[0];
    expect(m1.missingCo).toBe(1);
    expect(m1.missingRbt).toBe(1);
    expect(m1.missingDifficulty).toBe(1);
    expect(m1.completenessPct).toBe(0); // both have at least one missing field
  });

  // ── RBT Distribution ─────────────────────────────────────────

  it("distributes questions across RBT levels correctly", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, rbtLevel: "L1" }),
      makeQuestion({ moduleNumber: 1, rbtLevel: "L1" }),
      makeQuestion({ moduleNumber: 1, rbtLevel: "L2" }),
      makeQuestion({ moduleNumber: 2, rbtLevel: "L4" }),
      makeQuestion({ moduleNumber: 2, rbtLevel: "L6" }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.overallRbt.remember).toBe(2);
    expect(result.overallRbt.understand).toBe(1);
    expect(result.overallRbt.analyze).toBe(1);
    expect(result.overallRbt.create).toBe(1);
  });

  // ── Difficulty Distribution ──────────────────────────────────

  it("distributes questions across difficulty levels", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, difficultyLevel: "EASY" }),
      makeQuestion({ moduleNumber: 1, difficultyLevel: "MEDIUM" }),
      makeQuestion({ moduleNumber: 2, difficultyLevel: "HARD" }),
      makeQuestion({ moduleNumber: 2, difficultyLevel: "MEDIUM" }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.overallDifficulty.easy).toBe(1);
    expect(result.overallDifficulty.medium).toBe(2);
    expect(result.overallDifficulty.hard).toBe(1);
  });

  // ── Marks Distribution ───────────────────────────────────────

  it("groups questions by marks", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, marks: 2 }),
      makeQuestion({ moduleNumber: 1, marks: 2 }),
      makeQuestion({ moduleNumber: 1, marks: 5 }),
      makeQuestion({ moduleNumber: 2, marks: 10 }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.overallMarks[2]).toBe(2);
    expect(result.overallMarks[5]).toBe(1);
    expect(result.overallMarks[10]).toBe(1);
  });

  // ── CO Coverage ──────────────────────────────────────────────

  it("computes CO coverage percentages", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, coMapping: "CO1" }),
      makeQuestion({ moduleNumber: 2, coMapping: "CO1" }),
      makeQuestion({ moduleNumber: 1, coMapping: "CO2" }),
      makeQuestion({ moduleNumber: 3, coMapping: "CO1" }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    const co1 = result.coCoverage.find((c) => c.co === "CO1");
    const co2 = result.coCoverage.find((c) => c.co === "CO2");
    expect(co1).toBeDefined();
    expect(co1!.totalQuestions).toBe(3);
    expect(co1!.modules).toEqual([1, 2, 3]);
    expect(co2).toBeDefined();
    expect(co2!.totalQuestions).toBe(1);
  });

  // ── Constructive Alignment ────────────────────────────────────

  it("scores alignment based on metadata completeness", () => {
    const allComplete = [
      makeQuestion({ moduleNumber: 1, coMapping: "CO1", rbtLevel: "L1", difficultyLevel: "EASY", marks: 2 }),
      makeQuestion({ moduleNumber: 1, coMapping: "CO2", rbtLevel: "L3", difficultyLevel: "MEDIUM", marks: 5 }),
    ];
    const result = engine.evaluate(makeBankData(allComplete));
    expect(result.alignmentScore).toBeGreaterThan(0.5);
  });

  it("penalizes alignment when metadata is missing", () => {
    const missingData = [
      makeQuestion({ moduleNumber: 1, coMapping: null, rbtLevel: "L1", difficultyLevel: "EASY", marks: 2 }),
      makeQuestion({ moduleNumber: 1, coMapping: "CO2", rbtLevel: null, difficultyLevel: null, marks: 5 }),
    ];
    const result = engine.evaluate(makeBankData(missingData));
    expect(result.alignmentScore).toBeLessThan(1);
  });

  // ── Verdict ──────────────────────────────────────────────────

  it("returns 'Highly Effective' for scores >= 0.8", () => {
    const manyComplete = Array.from({ length: 6 }, (_, i) =>
      makeQuestion({ moduleNumber: (i % 3) + 1, coMapping: `CO${(i % 6) + 1}`, rbtLevel: `L${(i % 6) + 1}`, difficultyLevel: "MEDIUM", marks: 5 })
    );
    const result = engine.evaluate(makeBankData(manyComplete));
    expect(result.overallAverage).toBeGreaterThanOrEqual(0.8);
    expect(result.verdict.verdict).toBe("Highly Effective");
  });

  it("returns 'Needs Revision' for low scores", () => {
    const poor = [
      makeQuestion({ moduleNumber: 1, coMapping: null, rbtLevel: null, difficultyLevel: null, marks: 0 }),
    ];
    const result = engine.evaluate(makeBankData(poor));
    expect(result.verdict.verdict).toBe("Needs Revision");
  });

  // ── Question Findings ────────────────────────────────────────

  it("flags questions with missing CO mapping", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, coMapping: null }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.questionFindings.length).toBeGreaterThan(0);
    expect(result.questionFindings.some((f) => f.problem.includes("Missing CO"))).toBe(true);
  });

  it("flags RBT-marks misalignment", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, rbtLevel: "L5", marks: 2 }), // high RBT, low marks
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.questionFindings.some((f) => f.problem.includes("misaligned"))).toBe(true);
  });

  it("returns no findings for well-formed questions", () => {
    const questions = [
      makeQuestion({ moduleNumber: 1, coMapping: "CO1", rbtLevel: "L1", difficultyLevel: "EASY", marks: 2 }),
      makeQuestion({ moduleNumber: 2, coMapping: "CO2", rbtLevel: "L3", difficultyLevel: "MEDIUM", marks: 5 }),
      makeQuestion({ moduleNumber: 3, coMapping: "CO3", rbtLevel: "L5", difficultyLevel: "HARD", marks: 10 }),
    ];
    const result = engine.evaluate(makeBankData(questions));
    expect(result.questionFindings.length).toBe(0);
  });

  // ── Empty Bank ───────────────────────────────────────────────

  it("handles empty question list gracefully", () => {
    const result = engine.evaluate(makeBankData([]));
    expect(result.moduleSummary).toHaveLength(0);
    expect(result.overallAverage).toBe(0);
    expect(result.verdict.verdict).toBe("Needs Revision");
    expect(result.questionFindings).toHaveLength(0);
  });
});
