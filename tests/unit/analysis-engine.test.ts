import { QuestionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AnalysisEngine } from "@/modules/reports/analysis-engine";

describe("AnalysisEngine", () => {
  it("builds deterministic coverage and detects gaps", () => {
    const engine = new AnalysisEngine();
    const report = engine.buildDeterministicReport({
      id: "qb-1",
      subject: { subjectCode: "CS501", subjectName: "Advanced Algorithms" },
      examCycle: { academicYear: "2026-2027", semester: 5, examType: "ENDSEM" },
      questions: [
        {
          id: "q-1",
          moduleNumber: 1,
          marks: 2,
          questionText: "Explain the greedy choice property with a suitable algorithmic example.",
          coMapping: "CO1",
          rbtLevel: "L2",
          difficultyLevel: "EASY",
          status: QuestionStatus.APPROVED,
          teachingIndex: "T1",
        },
        {
          id: "q-2",
          moduleNumber: 1,
          marks: 5,
          questionText: "Analyze the amortized complexity of a disjoint set union operation sequence.",
          coMapping: "CO2",
          rbtLevel: "L4",
          difficultyLevel: "MEDIUM",
          status: QuestionStatus.APPROVED,
          teachingIndex: null,
        },
      ],
    } as never);

    expect(report.moduleCoverage).toHaveLength(6);
    expect(report.moduleCoverage[0].approved).toBe(2);
    expect(report.coDistribution.find((item) => item.key === "CO1")?.count).toBe(1);
    expect(report.missingAreas.length).toBeGreaterThan(0);
    expect(report.chartData.moduleCoverage).toHaveLength(6);
  });
});
