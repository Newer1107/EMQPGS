import { QuestionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ConstraintEngine } from "@/modules/paper-generation-engine/constraint-engine";
import { EvaluationEngine } from "@/modules/paper-generation-engine/evaluation-engine";
import { ConstraintAwareGreedyStrategy } from "@/modules/paper-generation-engine/strategies/constraint-aware-greedy";
import { PaperGenerationEngine } from "@/modules/paper-generation-engine/paper-generation-engine";
import { formatReport, summarize } from "@/modules/paper-generation-engine/score-report";
import { DEFAULT_TCET_PROFILE } from "@/modules/paper-generation-engine/types";
import { slotKey } from "@/modules/paper-generation-engine/constraint-engine";
import type { PaperSlot, SlotAssignment, PaperSolution } from "@/modules/paper-generation-engine/types";
import type { QuestionLibraryItem, QuestionUsageHistory } from "@prisma/client";

function makeQuestion(overrides: Partial<QuestionLibraryItem> & { id: string }): QuestionLibraryItem {
  return {
    moduleNumber: 1,
    marks: 2,
    questionText: "Test question?",
    coMapping: "CO1" as any,
    rbtLevel: "L1" as any,
    difficultyLevel: "MEDIUM" as any,
    teachingIndex: null,
    status: QuestionStatus.APPROVED,
    subjectVersionId: "sv1",
    createdById: "u1",
    ownerId: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as QuestionLibraryItem;
}

function makeUsage(questionId: string, overrides?: Partial<QuestionUsageHistory>): QuestionUsageHistory {
  return { id: `uh-${questionId}`, questionId, sourceType: "GENERATED_PAPER", sourceId: "p1", examCycleId: null, usedAt: new Date(), ...overrides } as QuestionUsageHistory;
}

function slot(m: number, mk: number): PaperSlot {
  return { moduleNumber: m, marks: mk, slotNumber: 1 };
}

const EMPTY_USAGE: QuestionUsageHistory[] = [];
const ISE_RANGE = [1, 2, 3];
const ENDSEM_RANGE = [1, 2, 3, 4, 5, 6];

/* ─── ConstraintEngine ───────────────────────── */

describe("ConstraintEngine", () => {
  describe("validateBankState", () => {
    it("passes for valid bank with all slots covered", () => {
      const engine = new ConstraintEngine({ moduleRange: ISE_RANGE, enforceUsageHistory: false, enforceConceptDiversity: false });
      const slots = [slot(1, 2), slot(1, 5), slot(1, 10), slot(2, 2), slot(2, 5), slot(2, 10), slot(3, 2), slot(3, 5), slot(3, 10)];
      const inv = new Map<string, QuestionLibraryItem[]>();
      for (const s of slots) inv.set(slotKey(s.moduleNumber, s.marks), [makeQuestion({ id: `q${s.moduleNumber}-${s.marks}` })]);
      const r = engine.validateBankState(slots, inv);
      expect(r.valid).toBe(true);
      expect(r.violations).toHaveLength(0);
    });

    it("rejects when a slot has no candidates", () => {
      const engine = new ConstraintEngine({ moduleRange: ISE_RANGE, enforceUsageHistory: false, enforceConceptDiversity: false });
      const slots = [slot(1, 2), slot(1, 5)];
      const inv = new Map([["1-2", [makeQuestion({ id: "q1" })]]]);
      const r = engine.validateBankState(slots, inv);
      expect(r.valid).toBe(false);
      expect(r.violations.some((v) => v.rule === "INSUFFICIENT_INVENTORY")).toBe(true);
    });

    it("rejects slot outside module range", () => {
      const engine = new ConstraintEngine({ moduleRange: ISE_RANGE, enforceUsageHistory: false, enforceConceptDiversity: false });
      const slots = [slot(4, 2)];
      const inv = new Map([["4-2", [makeQuestion({ id: "q1" })]]]);
      const r = engine.validateBankState(slots, inv);
      expect(r.valid).toBe(false);
      expect(r.violations.some((v) => v.rule === "MODULE_RANGE")).toBe(true);
    });
  });

  describe("validateAssignment", () => {
    it("passes for valid paper", () => {
      const engine = new ConstraintEngine({ moduleRange: ISE_RANGE, enforceUsageHistory: false, enforceConceptDiversity: false });
      const q1 = makeQuestion({ id: "q1", moduleNumber: 1, marks: 2 });
      const a: SlotAssignment[] = [{ slot: slot(1, 2), question: q1 }];
      const r = engine.validateAssignment(a, []);
      expect(r.valid).toBe(true);
    });

    it("rejects duplicate question ids", () => {
      const engine = new ConstraintEngine({ moduleRange: ISE_RANGE, enforceUsageHistory: false, enforceConceptDiversity: false });
      const q1 = makeQuestion({ id: "q1", moduleNumber: 1, marks: 2 });
      const a: SlotAssignment[] = [
        { slot: slot(1, 2), question: q1 },
        { slot: slot(2, 2), question: q1 },
      ];
      const r = engine.validateAssignment(a, []);
      expect(r.valid).toBe(false);
      expect(r.violations.some((v) => v.rule === "DUPLICATE_QUESTION")).toBe(true);
    });

    it("rejects question with wrong status", () => {
      const engine = new ConstraintEngine({ moduleRange: ISE_RANGE, enforceUsageHistory: false, enforceConceptDiversity: false });
      const q1 = makeQuestion({ id: "q1", status: QuestionStatus.DRAFT });
      const a: SlotAssignment[] = [{ slot: slot(1, 2), question: q1 }];
      const r = engine.validateAssignment(a, []);
      expect(r.valid).toBe(false);
      expect(r.violations.some((v) => v.rule === "QUESTION_STATUS")).toBe(true);
    });

    it("rejects used question when enforceUsageHistory is true", () => {
      const engine = new ConstraintEngine({ moduleRange: ISE_RANGE, enforceUsageHistory: true, enforceConceptDiversity: false });
      const q1 = makeQuestion({ id: "q1" });
      const a: SlotAssignment[] = [{ slot: slot(1, 2), question: q1 }];
      const r = engine.validateAssignment(a, [makeUsage("q1")]);
      expect(r.valid).toBe(false);
      expect(r.violations.some((v) => v.rule === "QUESTION_ALREADY_USED")).toBe(true);
    });

    it("detects marks mismatch", () => {
      const engine = new ConstraintEngine({ moduleRange: ISE_RANGE, enforceUsageHistory: false, enforceConceptDiversity: false });
      const q1 = makeQuestion({ id: "q1", marks: 5 });
      const a: SlotAssignment[] = [{ slot: slot(1, 2), question: q1 }];
      const r = engine.validateAssignment(a, []);
      expect(r.valid).toBe(false);
      expect(r.violations.some((v) => v.rule === "MARKS_MISMATCH")).toBe(true);
    });
  });
});

/* ─── EvaluationEngine ───────────────────────── */

describe("EvaluationEngine", () => {
  it("returns full score for a perfectly balanced paper", () => {
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, []);
    const qs: SlotAssignment[] = [];
    let idx = 0;
    for (const m of [1, 2, 3]) {
      for (const mk of [2, 5, 10] as const) {
        for (const bloom of ["L1", "L2", "L3", "L4", "L5", "L6"] as const) {
          if (idx % 6 === 0 || true) {
            qs.push({ slot: slot(m, mk), question: makeQuestion({ id: `q${idx++}`, moduleNumber: m, marks: mk, rbtLevel: bloom as any, difficultyLevel: "MEDIUM" as any, teachingIndex: `c${idx}` }) });
          }
        }
      }
    }
    const report = engine.evaluate(qs.slice(0, 9));
    expect(report.overall).toBeGreaterThan(80);
  });

  it("penalizes extreme difficulty", () => {
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, []);
    const qs = [
      makeQuestion({ id: "q1", moduleNumber: 1, marks: 2, difficultyLevel: "EASY" as any }),
      makeQuestion({ id: "q2", moduleNumber: 1, marks: 5, difficultyLevel: "EASY" as any }),
    ].map((q) => ({ slot: slot(q.moduleNumber, q.marks), question: q }));
    const report = engine.evaluate(qs);
    const diff = report.categories.find((c) => c.label === "Difficulty Balance")!;
    expect(diff.earned).toBeLessThan(diff.max);
    expect(diff.deductions.length).toBeGreaterThan(0);
  });

  it("penalizes single bloom level", () => {
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, []);
    const qs = [
      makeQuestion({ id: "q1", rbtLevel: "L1" as any }),
      makeQuestion({ id: "q2", rbtLevel: "L1" as any }),
    ].map((q) => ({ slot: slot(q.moduleNumber, q.marks), question: q }));
    const report = engine.evaluate(qs);
    const bloom = report.categories.find((c) => c.label === "Bloom Balance")!;
    expect(bloom.earned).toBe(0);
  });

  it("penalizes used questions in freshness", () => {
    const q1 = makeQuestion({ id: "q1" });
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, [makeUsage("q1")]);
    const qs = [{ slot: slot(1, 2), question: q1 }];
    const report = engine.evaluate(qs);
    const fresh = report.categories.find((c) => c.label === "Freshness")!;
    expect(fresh.earned).toBe(0);
  });

  it("returns full freshness for new questions", () => {
    const q1 = makeQuestion({ id: "q1" });
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, []);
    const qs = [{ slot: slot(1, 2), question: q1 }];
    const report = engine.evaluate(qs);
    const fresh = report.categories.find((c) => c.label === "Freshness")!;
    expect(fresh.earned).toBe(fresh.max);
  });

  it("handles empty assignments gracefully", () => {
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, []);
    const report = engine.evaluate([]);
    expect(report.overall).toBe(5); // only solve time returns full
    expect(report.categories.every((c) => c.earned >= 0)).toBe(true);
  });

  it("concept diversity penalizes duplicates", () => {
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, []);
    const qs = [
      makeQuestion({ id: "q1", teachingIndex: "TG1" }),
      makeQuestion({ id: "q2", teachingIndex: "TG1" }),
      makeQuestion({ id: "q3", teachingIndex: "TG2" }),
    ].map((q) => ({ slot: slot(q.moduleNumber, q.marks), question: q }));
    const report = engine.evaluate(qs);
    const cd = report.categories.find((c) => c.label === "Concept Diversity")!;
    expect(cd.earned).toBeLessThan(cd.max);
    expect(cd.deductions.length).toBeGreaterThan(0);
  });
});

/* ─── Score Report ───────────────────────────── */

describe("ScoreReport", () => {
  it("formatReport produces expected output", () => {
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, []);
    const q1 = makeQuestion({ id: "q1" });
    const report = engine.evaluate([{ slot: slot(1, 2), question: q1 }]);
    const text = formatReport(report);
    expect(text).toContain("Overall Score:");
    expect(text).toContain("Difficulty Balance:");
  });

  it("summarize includes deduction notes", () => {
    const engine = new EvaluationEngine(DEFAULT_TCET_PROFILE, [makeUsage("q1")]);
    const q1 = makeQuestion({ id: "q1" });
    const report = engine.evaluate([{ slot: slot(1, 2), question: q1 }]);
    const text = summarize(report);
    expect(text).toContain("Overall:");
  });
});

/* ─── Greedy Strategy ────────────────────────── */

describe("ConstraintAwareGreedyStrategy", () => {
  it("produces a valid paper with slots filled", () => {
    const strategy = new ConstraintAwareGreedyStrategy();
    const slots = [slot(1, 2), slot(1, 5), slot(1, 10)];
    const inv = new Map<string, QuestionLibraryItem[]>();
    for (const s of slots) {
      inv.set(slotKey(s.moduleNumber, s.marks), [makeQuestion({ id: `q${s.moduleNumber}-${s.marks}`, moduleNumber: s.moduleNumber, marks: s.marks })]);
    }
    const engine = new PaperGenerationEngine({ moduleRange: [1], enforceUsageHistory: false, enforceConceptDiversity: false }, strategy);
    const { solution } = engine.generate(inv, [], "PAPER_A");
    expect(solution.assignments).toHaveLength(3);
    expect(solution.variant).toBe("PAPER_A");
    expect(solution.report.overall).toBeGreaterThan(0);
  });

  it("produces the same result deterministically", () => {
    const strategy = new ConstraintAwareGreedyStrategy();
    const slots = [slot(1, 2), slot(1, 5), slot(1, 10)];
    const inv = new Map<string, QuestionLibraryItem[]>();
    for (const s of slots) {
      inv.set(slotKey(s.moduleNumber, s.marks), [
        makeQuestion({ id: `q${s.moduleNumber}-${s.marks}-a`, moduleNumber: s.moduleNumber, marks: s.marks, difficultyLevel: "EASY" as any }),
        makeQuestion({ id: `q${s.moduleNumber}-${s.marks}-b`, moduleNumber: s.moduleNumber, marks: s.marks, difficultyLevel: "HARD" as any }),
      ]);
    }
    const engine = new PaperGenerationEngine({ moduleRange: [1], enforceUsageHistory: false, enforceConceptDiversity: false }, strategy);
    const { solution: a } = engine.generate(inv, [], "PAPER_A");
    const { solution: b } = engine.generate(inv, [], "PAPER_A");
    expect(a.assignments.map((x) => x.question.id)).toEqual(b.assignments.map((x) => x.question.id));
  });

  it("throws when no candidates available", () => {
    const strategy = new ConstraintAwareGreedyStrategy();
    const inv = new Map<string, QuestionLibraryItem[]>();
    const engine = new PaperGenerationEngine({ moduleRange: [1, 2, 3] }, strategy);
    expect(() => engine.generate(inv, [], "PAPER_A")).toThrow("Bank state validation failed");
  });

  it("picks the scoring-best candidate among multiple options", () => {
    const strategy = new ConstraintAwareGreedyStrategy();
    const inv = new Map<string, QuestionLibraryItem[]>();
    // Slot 1-2 has two candidates; one is EASY (worse for balance), one is MEDIUM (better)
    inv.set("1-2", [
      makeQuestion({ id: "q-easy", moduleNumber: 1, marks: 2, difficultyLevel: "EASY" as any, rbtLevel: "L1" as any, teachingIndex: "T1" }),
      makeQuestion({ id: "q-med", moduleNumber: 1, marks: 2, difficultyLevel: "MEDIUM" as any, rbtLevel: "L2" as any, teachingIndex: "T2" }),
    ]);
    inv.set("1-5", [makeQuestion({ id: "q5", moduleNumber: 1, marks: 5, difficultyLevel: "MEDIUM" as any, rbtLevel: "L3" as any, teachingIndex: "T3" })]);
    inv.set("1-10", [makeQuestion({ id: "q10", moduleNumber: 1, marks: 10, difficultyLevel: "MEDIUM" as any, rbtLevel: "L4" as any, teachingIndex: "T4" })]);
    const engine = new PaperGenerationEngine({ moduleRange: [1], enforceUsageHistory: false, enforceConceptDiversity: false }, strategy);
    const { solution } = engine.generate(inv, [], "PAPER_A");
    // MEDIUM question should be preferred over EASY for first slot
    const slot1 = solution.assignments.find((a) => a.slot.marks === 2)!;
    expect(slot1.question.difficultyLevel).toBe("MEDIUM");
  });
});

/* ─── Full Integration ───────────────────────── */

describe("PaperGenerationEngine (integration)", () => {
  it("generates a complete ENDSEM paper with 18 slots", () => {
    const strategy = new ConstraintAwareGreedyStrategy();
    const inv = new Map<string, QuestionLibraryItem[]>();
    let id = 0;
    for (const m of ENDSEM_RANGE) {
      for (const mk of [2, 5, 10] as const) {
        inv.set(slotKey(m, mk), [
          makeQuestion({
            id: `q${id++}`, moduleNumber: m, marks: mk,
            difficultyLevel: (["EASY", "MEDIUM", "HARD"] as const)[id % 3] as any,
            rbtLevel: (["L1", "L2", "L3", "L4", "L5", "L6"] as const)[id % 6] as any,
            teachingIndex: `TG${id % 4}`,
          }),
        ]);
      }
    }
    const engine = new PaperGenerationEngine({ moduleRange: ENDSEM_RANGE, enforceUsageHistory: false, enforceConceptDiversity: false }, strategy);
    const { solution } = engine.generate(inv, [], "PAPER_A");
    expect(solution.assignments).toHaveLength(18);
    expect(solution.report.overall).toBeGreaterThan(0);
    expect(solution.report.categories).toHaveLength(6);
  });

  it("generates multiple variant without reusing questions", () => {
    const strategy = new ConstraintAwareGreedyStrategy();
    const inv = new Map<string, QuestionLibraryItem[]>();
    let id = 0;
    for (const m of [1, 2, 3]) {
      for (const mk of [2, 5, 10] as const) {
        // Multiple questions per slot so variants can pick different ones
        const qs = [0, 1, 2].map((i) => makeQuestion({
          id: `q${id++}`, moduleNumber: m, marks: mk,
          difficultyLevel: (["EASY", "MEDIUM", "HARD"] as const)[i] as any,
          rbtLevel: (["L1", "L2", "L3", "L4", "L5", "L6"] as const)[i] as any,
          teachingIndex: `TG-${m}-${mk}-${i}`,
        }));
        inv.set(slotKey(m, mk), qs);
      }
    }

    const consumed = new Set<string>();
    const papers: PaperSolution[] = [];
    for (const variant of ["PAPER_A", "PAPER_B", "PAPER_C"]) {
      const variantInv = new Map<string, QuestionLibraryItem[]>();
      for (const [key, questions] of inv) {
        const avail = questions.filter((q) => !consumed.has(q.id));
        if (avail.length > 0) variantInv.set(key, avail);
      }
      const engine = new PaperGenerationEngine({ moduleRange: [1, 2, 3] }, strategy);
      const { solution: sol } = engine.generate(variantInv, [], variant);
      for (const a of sol.assignments) consumed.add(a.question.id);
      papers.push(sol);
    }

    expect(papers).toHaveLength(3);
    expect(papers.every((p) => p.assignments.length === 9)).toBe(true);
    // Verify no question reused across variants
    const allIds = papers.flatMap((p) => p.assignments.map((a) => a.question.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
