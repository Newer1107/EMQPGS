import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { buildUafReport, isUafVersion, PHASES, UNVERIFIABLE, unwrapEnvelope } from "@/modules/uaf-export/report-model";
import { exportUafPdf } from "@/modules/uaf-export/pdf";
import { SOURCE_PDF_HEADERS } from "@/modules/uaf-export/source-pdf-contract";

const version = (questions: unknown[] = []) => ({
  id: "version-1", versionNumber: 1, evaluationEngineVersion: "1.0", evidenceHash: "abc",
  questionBankAnalysis: { metrics: [{ indexCode: "SCI", value: 1 }], executiveSummary: "MUTABLE LATEST RESULT" },
  analysisSnapshot: { fullReport: { result: {
    executiveSummary: "Immutable summary", metrics: [
      { indexCode: "SCI", value: .4, confidenceScore: .95 }, { indexCode: "OCI", value: .65 },
    ],
  }, snapshot: { questions, totalQuestions: questions.length, structuralElements: [
    { element: "courseInformation", present: true }, { element: "questionNumbering", present: false }, { element: "marksAllocation", present: null },
  ] } } },
});
function table(input: unknown, id: string) { return buildUafReport(input).sections.flatMap(s => s.tables).find(t => t.id === id)!; }

describe("UAF report contract", () => {
  it("preserves all 15 numbered phases in the specified order", () => {
    const report = buildUafReport(version());
    expect(report.sections.map(s => s.title)).toEqual(PHASES);
    expect(report.sections.map(s => s.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(report.sections[6].title).toBe("Marks Complexity Alignment Index (MCAI)");
    expect(report.sections[7].title).toBe("Difficulty Balance Index (DBI)");
  });
  it("preserves every framework table and every column against the architecture document", () => {
    const lines = readFileSync("docs/architecture/uaf-framework-extraction.md", "utf8").split("\n");
    const actual = buildUafReport(version()).sections.flatMap(s => s.tables);
    let heading = "";
    for (let i = 0; i < lines.length; i++) {
      if (/^#{2,4} /.test(lines[i])) heading = lines[i].replace(/^#+ /, "");
      if (lines[i].startsWith("|") && lines[i + 1]?.includes("---") && /^\|[- :|]+\|$/.test(lines[i + 1])) {
        const expected = lines[i].split("|").slice(1, -1).map(c => c.trim().replace(/\*\*/g, ""));
        const id = heading.split(" ")[0];
        expect(actual.find(t => t.id === id)?.headers, heading).toEqual(SOURCE_PDF_HEADERS[id] ?? expected);
      }
    }
    for (const t of actual) for (const row of t.rows) expect(row.length, t.title).toBe(t.headers.length);
  });
  it("uses real questions, keeps missing PO/PI explicit, and never fabricates structural presence", () => {
    const input = version([{ questionIndex: 4, questionText: "Explain entropy", marks: 7, coMapping: "CO1", rbtLevel: "Understand", difficultyLevel: "Medium" }]);
    expect(table(input, "4.3").rows[0]).toEqual(["4", "Explain entropy", "7", "CO1", UNVERIFIABLE, UNVERIFIABLE, "Understand", "Medium", UNVERIFIABLE]);
    expect(table(version([{ sourceQuestionId: "original_qid", questionIndex: 1 }]), "4.3").rows[0][0]).toBe("original_qid");
    expect(table(input, "3.3").rows.slice(0, 3).map(r => r[1])).toEqual(["Present", "Absent", UNVERIFIABLE]);
    expect(table(input, "5.2").rows[0][2]).toBe("7");
    expect(table(version(), "4.3").rows[0].every(c => c === UNVERIFIABLE)).toBe(true);
  });
  it("separates confidence from quality and reads immutable results inside the API envelope", () => {
    const report = buildUafReport({ success: true, data: version() });
    expect(report.sections[0].narrative).toContain("Immutable summary");
    expect(report.sections[2].confidence).toContain("95.0%");
    expect(report.sections[2].confidence).toContain("Very High");
    expect(table(version(), "3.14").rows[0]).toEqual(["SCI", "0.4", "Major Revision Required", "0.95"]);
    expect(report.sections[13].confidence).toContain("Medium");
    expect(unwrapEnvelope({ success: true, data: [] })).toEqual([]);
    expect(() => unwrapEnvelope({ success: false, error: { message: "Denied" } })).toThrow("Denied");
  });
  it("does not substitute a newer mutable analysis for missing historical evidence", () => {
    const input = { id: "old", questionBankAnalysis: { metrics: [{ indexCode: "SCI", value: 1 }] } };
    expect(table(input, "3.14").rows[0][1]).toBe(UNVERIFIABLE);
    expect(buildUafReport(input).sections[0].narrative).toContain(UNVERIFIABLE);
  });
  it("preserves source-PDF-only columns and the missing data protocol", () => {
    expect(table(version(), "4.3").headers).toEqual(["QID", "Question Text", "Marks", "CO", "PO", "PI", "RBT", "Difficulty", "Status"]);
    expect(table(version(), "11.7").headers).toEqual(["ID", "Strength"]);
    expect(table(version(), "11.8").headers).toEqual(["ID", "Weakness"]);
    expect(table(version(), "2.2").headers).toEqual(["Step", "Required Action"]);
  });
  it("shows reviewed question quality only with traceable evidence, never legacy clarity defaults", () => {
    const qualityEvidence = Object.fromEntries(["clarity", "precision", "technicalAccuracy", "context", "validity", "alignment", "fairness"].map(key => [key, { criterion: key, score: .8, sourceIds: ["review:original-q:source"] }]));
    const input = version([{ sourceQuestionId: "reviewed", clarityScore: 0, qualityEvidence }, { sourceQuestionId: "unreviewed", clarityScore: 0 }]);
    const rows = table(input, "9.3").rows;
    expect(rows[0].slice(1, 8)).toEqual(Array(7).fill("0.8"));
    expect(Number(rows[0][8])).toBeCloseTo(.8);
    expect(rows[1].slice(1)).toEqual(Array(8).fill(UNVERIFIABLE));
    expect(table(input, "9.6").rows[0][1]).toBe(UNVERIFIABLE);
  });
  it("filters legacy versions using the parent engine and explains absent AI modules", () => {
    expect(isUafVersion({ evaluationEngineVersion: "1.0", questionBankAnalysis: { evaluationEngineVersion: "eval-1.0" } })).toBe(false);
    expect(isUafVersion({ evaluationEngineVersion: "1.0" })).toBe(true);
    expect(buildUafReport(version()).sections[0].narrative).toContain("no saved AI module results");
  });
});

describe("paginated PDF export", () => {
  it("exports a readable multi-page PDF with repeated headers, last question, all phases, and footers", async () => {
    const questions = Array.from({ length: 100 }, (_, i) => ({ questionIndex: i + 1, questionText: i === 0 ? "Long question ".repeat(1700) : `Question evidence ${i + 1}`, marks: 5 }));
    const bytes = await exportUafPdf(version(questions));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(15);
    const pageTexts = pdf.getPages().map(page => {
      const contents = page.node.Contents();
      const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
      return streams.filter((s): s is PDFRawStream => s instanceof PDFRawStream).map(stream => {
        const ops = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
        return Array.from(ops.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g), m => Buffer.from(m[1], "hex").toString("latin1")).join(" ");
      }).join(" ");
    });
    const text = pageTexts.join(" ");
    expect(text).toContain("Question evidence 100");
    expect(text).toContain("15. Final Verdict");
    expect(text.match(/Master Question Extraction Table/g)!.length).toBeGreaterThan(1);
    expect(text.match(/Question Text/g)!.length).toBeGreaterThan(1);
    expect(text).toContain(UNVERIFIABLE);
    pageTexts.forEach((text, i) => expect(text).toContain(`Page ${i + 1} of ${pdf.getPageCount()}`));
  }, 30000);
});
