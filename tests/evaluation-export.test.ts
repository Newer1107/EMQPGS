import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { exportEvaluationPdf } from "@/modules/evaluation-export/pdf";
import type { EvaluationReport } from "@/lib/evaluation/types";

const rbt = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };
function report(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    objective: { subjectName: "Algorithms", subjectCode: "CS1", batchName: "2026", semesterNumber: 3, academicYear: "2026-27", departmentName: "CSE", totalQuestions: 10, evaluationDate: "2026-09-23T00:00:00.000Z", narrative: "Objective narrative." },
    moduleSummary: [{ moduleNumber: 1, moduleName: "Foundations", totalSlots: 5, filledSlots: 4, totalMarks: 20, category: "Theory", articulation: "CO1, CO2" }],
    moduleSummaryAiNarrative: "Module summary narrative.",
    attributeCompleteness: [{ moduleNumber: 1, totalQuestions: 4, metadataComplete: 3, missingRbt: 1, missingCo: 0, missingDifficulty: 0, missingMarks: 0, completenessPct: 75 }],
    overallCompletenessPct: 75,
    attributeAiNarrative: "Attribute narrative.",
    overallRbt: rbt, moduleRbt: [{ moduleNumber: 1, distribution: rbt, total: 21 }], idealDistribution: rbt,
    rbtAiNarrative: "RBT narrative.",
    overallDifficulty: { easy: 4, medium: 4, hard: 2 }, moduleDifficulty: [{ moduleNumber: 1, distribution: { easy: 4, medium: 4, hard: 2 }, total: 10 }],
    difficultyAiNarrative: "Difficulty narrative.",
    overallMarks: { 2: 4, 5: 4, 10: 2 }, moduleMarks: [{ moduleNumber: 1, distribution: { 2: 4, 5: 4, 10: 2 }, total: 10 }],
    marksAiNarrative: "Marks narrative.",
    coCoverage: [{ co: "CO1", totalQuestions: 5, modules: [1], coveragePct: 100 }], coCoverageAiNarrative: "CO narrative.",
    alignmentSummary: { score: 0.82, risks: ["One risk"], recommendations: ["One recommendation"] }, alignmentAiNarrative: "Alignment narrative.",
    qualityMetrics: [{ moduleNumber: 1, clarity: 0.8, relevance: 0.7, rbtAccuracy: 0.9, poPiCoverage: 0.5, remarks: "Good" }], qualityAiNarrative: "Quality narrative.",
    finalAssessments: [{ moduleNumber: 1, rating: "Effective", threshold: 0.7, strengths: ["Clear"], weaknesses: ["Sparse"], recommendations: ["Add HOTS"] }], finalAssessmentAiNarrative: "Final assessment narrative.",
    consolidatedScores: [{ moduleNumber: 1, clarity: 0.8, relevance: 0.7, rbtAccuracy: 0.9, completeness: 0.75, average: 0.79, overallScore: 0.8 }], overallAverage: 0.79,
    verdict: { verdict: "Highly Effective", overallScore: 0.82, thresholds: { highlyEffective: 0.8, moderatelyEffective: 0.6, needsRevision: 0.4 } }, verdictAiNarrative: "Verdict narrative.",
    questionFindings: [{ slotId: "s1", moduleNumber: 1, marks: 5, currentRbt: "L2", difficulty: "Medium", co: "CO1", problem: "Problem", pedagogicalConsequence: "Consequence", recommendation: "Recommendation", confidence: 80 }], findingsAiNarrative: "Findings narrative.",
    engineVersion: "eval-1.0.0", promptVersion: "eval-prompt-1.1.0", generationDurationMs: 1000,
    ...overrides,
  };
}
async function textOf(bytes: Uint8Array): Promise<{ pages: number; text: string; pageTexts: string[] }> {
  const pdf = await PDFDocument.load(bytes);
  const pageTexts = pdf.getPages().map(page => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    return streams.filter((s): s is PDFRawStream => s instanceof PDFRawStream).map(stream => {
      const ops = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      return Array.from(ops.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g), m => Buffer.from(m[1], "hex").toString("latin1")).join(" ");
    }).join(" ");
  });
  return { pages: pdf.getPageCount(), text: pageTexts.join(" "), pageTexts };
}

describe("evaluation report PDF export", () => {
  it("renders every section, the verdict and footers", async () => {
    const { text, pages, pageTexts } = await textOf(await exportEvaluationPdf(report(), 3));
    expect(pages).toBeGreaterThanOrEqual(1);
    for (const title of ["1. Objective", "2. Module Summary", "3. Attribute Completeness", "4. RBT Distribution", "5. Difficulty Distribution", "6. Marks Distribution", "7. CO Coverage", "8. Constructive Alignment", "9. Quality Metrics", "10. Final Assessment", "11. Consolidated Scores", "12. Final Verdict", "13. Question-Level Findings"]) {
      expect(text, title).toContain(title);
    }
    expect(text).toContain("Highly Effective");
    expect(text).toContain("82%");
    pageTexts.forEach((t, i) => expect(t).toContain(`Page ${i + 1} of ${pages}`));
  });
  it("paginates long question findings without losing content", async () => {
    const findings = Array.from({ length: 80 }, (_, i) => ({ slotId: `s${i + 1}`, moduleNumber: 1, marks: 5, currentRbt: "L2", difficulty: "Medium", co: "CO1", problem: `Problem ${i + 1} `.repeat(40), pedagogicalConsequence: "Consequence", recommendation: "Recommendation", confidence: 80 }));
    const { pages, text } = await textOf(await exportEvaluationPdf(report({ questionFindings: findings }), 1));
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain("Problem 80");
    expect(text).toContain("(continued)");
  }, 30000);
  it("renders missing narrative as an explicit placeholder", async () => {
    const { text } = await textOf(await exportEvaluationPdf(report({ objective: { ...report().objective, narrative: "" } }), 1));
    // StandardFonts encode the em-dash placeholder as WinAnsi 0x97; latin1 extraction yields the control char.
    expect(text).toContain("\x97");
  });
});
