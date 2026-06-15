import { describe, it, expect } from "vitest";
import { QuestionStatus } from "@prisma/client";
import { AnalysisEngine } from "@/modules/reports/analysis-engine";

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
      examCycle: { academicYear: "2026-2027", semester: 5, examType: "ENDSEM" },
      slots: [mockSlot(), mockSlot({ moduleNumber: 2, marks: 10 }), mockSlot({ moduleNumber: 3, marks: 5 })],
    } as any);

    expect(report.inventory.approvedQuestions).toBe(3);
    expect(report.moduleCoverage).toHaveLength(6);
  });

  it("handles empty slots gracefully", () => {
    const report = engine.buildDeterministicReport({
      id: "qb-2",
      subject: { subjectCode: "CS502" },
      examCycle: {},
      slots: [],
    } as any);

    expect(report.inventory.approvedQuestions).toBe(0);
  });
});
