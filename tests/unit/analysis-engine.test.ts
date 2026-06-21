import { describe, it, expect } from "vitest";
import { QuestionStatus } from "@prisma/client";
import { AnalysisEngine } from "@/modules/reports/analysis-engine";

const defaultPattern = {
  totalModules: 6,
  marksPattern: [2, 5, 10],
  slotsPerModule: 7,
  totalSlots: 126,
  id: "p1",
  questionBankId: "qb-1",
  examType: "ENDSEM",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSlot = (overrides: Record<string, unknown> = {}) => ({
  moduleNumber: 1,
  marks: 5,
  slotNumber: 1,
  assignedQuestion: {
    id: "q-1",
    moduleNumber: 1,
    marks: 5,
    questionText: "Test question.",
    coMapping: "CO1",
    rbtLevel: "L2",
    difficultyLevel: "MEDIUM",
    status: QuestionStatus.APPROVED,
    teachingIndex: "T1",
    ...overrides,
  },
});

describe("AnalysisEngine", () => {
  const engine = new AnalysisEngine();

  it("builds deterministic report from slots", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-1",
      subject: { subjectCode: "CS501", subjectName: "Advanced Algorithms" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: defaultPattern,
      slots: [mockSlot(), mockSlot({ moduleNumber: 2, marks: 10 }), mockSlot({ moduleNumber: 3, marks: 5 })],
    } as any);

    expect(report.inventory.approvedQuestions).toBe(3);
    expect(report.moduleCoverage).toHaveLength(6);
  });

  it("handles empty slots gracefully", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-2",
      subject: { subjectCode: "CS502" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: defaultPattern,
      slots: [],
    } as any);

    expect(report.inventory.approvedQuestions).toBe(0);
  });

  it("uses pattern-derived module target", () => {
    const customPattern = { ...defaultPattern, marksPattern: [2, 5], slotsPerModule: 5 };
    const report = engine.buildDeterministicReport({
      id: "qb-3",
      subject: { subjectCode: "CS503" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: customPattern,
      slots: [mockSlot()],
    } as any);

    expect(report.moduleCoverage[0].total).toBe(10);
    expect(report.moduleCoverage[0].approved).toBe(1);
    expect(report.moduleCoverage[0].missing).toBe(9);
  });

  it("defaults to 6 modules and 21 target when pattern missing", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-4",
      subject: { subjectCode: "CS504" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: null,
      slots: [mockSlot()],
    } as any);

    expect(report.moduleCoverage).toHaveLength(6);
    expect(report.moduleCoverage[0].total).toBe(21);
  });

  it("detects duplicate questions by text similarity", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-5",
      subject: { subjectCode: "CS505" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: defaultPattern,
      slots: [
        { moduleNumber: 1, marks: 5, slotNumber: 1, assignedQuestion: { id: "q1", questionText: "Explain the concept of inheritance in object oriented programming", status: QuestionStatus.APPROVED, moduleNumber: 1, marks: 5, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM", teachingIndex: "T1" } },
        { moduleNumber: 1, marks: 5, slotNumber: 2, assignedQuestion: { id: "q2", questionText: "Explain the concept of inheritance in object oriented programming paradigm", status: QuestionStatus.APPROVED, moduleNumber: 1, marks: 5, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM", teachingIndex: "T2" } },
        { moduleNumber: 1, marks: 5, slotNumber: 3, assignedQuestion: { id: "q3", questionText: "What is the capital of France", status: QuestionStatus.APPROVED, moduleNumber: 1, marks: 5, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM", teachingIndex: "T3" } },
      ],
    } as any);

    expect(report.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(report.duplicates[0].score).toBeGreaterThanOrEqual(0.5);
  });

  it("returns empty duplicates for dissimilar questions", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-6",
      subject: { subjectCode: "CS506" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: defaultPattern,
      slots: [
        { moduleNumber: 1, marks: 5, slotNumber: 1, assignedQuestion: { id: "q1", questionText: "Describe the waterfall model in software engineering", status: QuestionStatus.APPROVED, moduleNumber: 1, marks: 5, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM", teachingIndex: "T1" } },
        { moduleNumber: 1, marks: 5, slotNumber: 2, assignedQuestion: { id: "q2", questionText: "Calculate the Fourier transform of a square wave", status: QuestionStatus.APPROVED, moduleNumber: 1, marks: 5, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM", teachingIndex: "T2" } },
      ],
    } as any);

    expect(report.duplicates).toHaveLength(0);
  });

  it("includes difficulty distribution in missing areas", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-7",
      subject: { subjectCode: "CS507" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: defaultPattern,
      slots: [],
    } as any);

    const allDifficulties = report.difficultyDistribution;
    const missingDifficulty = report.missingAreas.filter((m) => m.includes("difficulty"));
    expect(missingDifficulty.length).toBe(allDifficulties.length);
  });

  it("computes inventory warnings based on question count", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-8",
      subject: { subjectCode: "CS508" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: defaultPattern,
      slots: [mockSlot()],
    } as any);

    expect(report.inventory.approvedQuestions).toBe(1);
    expect(report.inventory.remainingWarning).toBe(true);
    expect(report.inventory.remainingCritical).toBe(true);
    expect(report.inventory.exhausted).toBe(false);
  });

  it("marks inventory exhausted when no approved questions", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-9",
      subject: { subjectCode: "CS509" },
      batchSemester: { academicYear: { code: "2026-2027" }, semesterNumber: 5 },
      pattern: defaultPattern,
      slots: [
        { moduleNumber: 1, marks: 5, slotNumber: 1, assignedQuestion: { id: "q1", questionText: "Test", moduleNumber: 1, marks: 5, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM", status: QuestionStatus.DRAFT, teachingIndex: "T1" } },
      ],
    } as any);

    expect(report.inventory.exhausted).toBe(true);
  });
});
