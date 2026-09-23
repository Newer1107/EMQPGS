import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import type { EvaluationReport } from "@/lib/evaluation/types";

/** Standard PDF fonts cannot encode all source scripts. Escape unsupported code points losslessly. */
function fontText(text: string, font: PDFFont): string {
  return Array.from(text.normalize("NFC")).map(char => {
    if (char === "\n" || char === "\r") return " ";
    try { font.encodeText(char); return char; }
    catch { return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`; }
  }).join("");
}
function wrap(text: string, width: number, font: PDFFont, size: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of fontText(text, font).split(/\s+/)) {
    if (line && font.widthOfTextAtSize(`${line} ${word}`, size) <= width) { line += ` ${word}`; continue; }
    if (line) { lines.push(line); line = ""; }
    for (const char of word) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ""; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
const pct = (value: number, total: number) => total > 0 ? `${((value / total) * 100).toFixed(0)}%` : "0%";
const score = (value: number) => `${(value * 100).toFixed(0)}%`;

/** Renders a stored evaluation report to a printable PDF. Missing narrative is rendered as "—". */
export async function exportEvaluationPdf(report: EvaluationReport, versionNumber: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Question Bank Evaluation — Version ${versionNumber}`);
  const width = 841.89, height = 595.28, margin = 32, bottom = 38, lineHeight = 11, size = 8;
  let page = doc.addPage([width, height]);
  let y = height - margin;
  const write = (text: string, x: number, top: number, fontSize = size, strong = false) => page.drawText(fontText(text, strong ? bold : font), { x, y: top - fontSize, size: fontSize, font: strong ? bold : font });
  const newPage = () => { page = doc.addPage([width, height]); y = height - margin; write(`Question Bank Evaluation · Version ${versionNumber} · Continued`, margin, y, 9, true); y -= 22; };
  const paragraph = (text: string, fontSize = 9, strong = false) => {
    for (const line of wrap(text, width - margin * 2, strong ? bold : font, fontSize)) {
      if (y - (fontSize + 5) < bottom) newPage();
      write(line, margin, y, fontSize, strong); y -= fontSize + 5;
    }
  };
  const heading = (text: string) => { if (y < bottom + 40) newPage(); y -= 10; paragraph(text, 12, true); };
  const table = (title: string, headers: string[], rows: string[][]) => {
    if (y < bottom + 60) newPage();
    y -= 6;
    paragraph(title, 10, true);
    const weights = headers.map(h => /Problem|Consequence|Recommendation|Remarks|Narrative|Name/.test(h) ? 3 : 1);
    const total = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map(w => (width - margin * 2) * w / total);
    const wrappedHeaders = headers.map((h, i) => wrap(h, widths[i] - 8, bold, size));
    const headerHeight = Math.max(...wrappedHeaders.map(h => h.length)) * lineHeight + 8;
    const drawCells = (cells: string[][], offset: number, count: number, header = false) => {
      const h = count * lineHeight + 8;
      let x = margin;
      for (let i = 0; i < cells.length; i++) {
        page.drawRectangle({ x, y: y - h, width: widths[i], height: h, borderWidth: .4, borderColor: rgb(.7, .73, .76), ...(header ? { color: rgb(.91, .94, .97) } : {}) });
        for (let j = 0; j < count; j++) if (cells[i][offset + j]) write(cells[i][offset + j], x + 4, y - 4 - j * lineHeight, size, header);
        x += widths[i];
      }
      y -= h;
    };
    const tableHeading = (continued = false) => { paragraph(`${title}${continued ? " (continued)" : ""}`, 10, true); drawCells(wrappedHeaders, 0, Math.max(...wrappedHeaders.map(h => h.length)), true); };
    if (y < bottom + headerHeight + 65) newPage();
    tableHeading();
    for (const row of rows) {
      const cells = row.map((cell, i) => wrap(cell, widths[i] - 8, font, size));
      const lines = Math.max(...cells.map(c => c.length));
      let offset = 0;
      if (lines * lineHeight + 8 > y - bottom && lines * lineHeight + 8 <= height - margin - bottom - headerHeight - 70) { newPage(); tableHeading(true); }
      while (offset < lines) {
        let available = Math.floor((y - bottom - 8) / lineHeight);
        if (available < 1) { newPage(); tableHeading(true); available = Math.floor((y - bottom - 8) / lineHeight); }
        const count = Math.min(available, lines - offset);
        drawCells(cells, offset, count); offset += count;
      }
    }
    y -= 14;
  };

  paragraph(`Question Bank Evaluation Report · Version ${versionNumber}`, 17, true);
  paragraph(`Engine: ${report.engineVersion} · Prompt: ${report.promptVersion}`);
  paragraph(`Verdict: ${report.verdict.verdict} · Overall score: ${score(report.verdict.overallScore)} · Questions: ${report.objective.totalQuestions}`);

  heading("1. Objective");
  table("Context", ["Field", "Value"], [
    ["Subject", `${report.objective.subjectCode} ${report.objective.subjectName}`],
    ["Batch", report.objective.batchName || "—"],
    ["Semester", String(report.objective.semesterNumber)],
    ["Academic year", report.objective.academicYear || "—"],
    ["Department", report.objective.departmentName || "—"],
    ["Total questions", String(report.objective.totalQuestions)],
    ["Evaluated at", report.objective.evaluationDate],
  ]);
  paragraph(report.objective.narrative || "—");

  heading("2. Module Summary");
  table("Modules", ["Module", "Name", "Slots", "Filled", "Marks", "Category", "COs"], report.moduleSummary.map(m => [
    String(m.moduleNumber), m.moduleName || "—", String(m.totalSlots), String(m.filledSlots), String(m.totalMarks), m.category, m.articulation || "—",
  ]));
  paragraph(report.moduleSummaryAiNarrative || "—");

  heading("3. Attribute Completeness");
  table("Completeness", ["Module", "Questions", "Complete", "Missing RBT", "Missing CO", "Missing Difficulty", "Missing Marks", "Complete %"], report.attributeCompleteness.map(m => [
    String(m.moduleNumber), String(m.totalQuestions), String(m.metadataComplete), String(m.missingRbt), String(m.missingCo), String(m.missingDifficulty), String(m.missingMarks), `${m.completenessPct.toFixed(0)}%`,
  ]));
  paragraph(`Overall completeness: ${report.overallCompletenessPct.toFixed(0)}%`);
  paragraph(report.attributeAiNarrative || "—");

  const rbt = report.overallRbt;
  const rbtTotal = rbt.remember + rbt.understand + rbt.apply + rbt.analyze + rbt.evaluate + rbt.create;
  heading("4. RBT Distribution");
  table("Bloom levels", ["Level", "Observed", "%", "Ideal %"], [
    ["Remember", String(rbt.remember), pct(rbt.remember, rbtTotal), pct(report.idealDistribution.remember, rbtTotal)],
    ["Understand", String(rbt.understand), pct(rbt.understand, rbtTotal), pct(report.idealDistribution.understand, rbtTotal)],
    ["Apply", String(rbt.apply), pct(rbt.apply, rbtTotal), pct(report.idealDistribution.apply, rbtTotal)],
    ["Analyze", String(rbt.analyze), pct(rbt.analyze, rbtTotal), pct(report.idealDistribution.analyze, rbtTotal)],
    ["Evaluate", String(rbt.evaluate), pct(rbt.evaluate, rbtTotal), pct(report.idealDistribution.evaluate, rbtTotal)],
    ["Create", String(rbt.create), pct(rbt.create, rbtTotal), pct(report.idealDistribution.create, rbtTotal)],
  ]);
  paragraph(report.rbtAiNarrative || "—");

  const diff = report.overallDifficulty;
  const diffTotal = diff.easy + diff.medium + diff.hard;
  heading("5. Difficulty Distribution");
  table("Difficulty", ["Level", "Observed", "%"], [
    ["Easy", String(diff.easy), pct(diff.easy, diffTotal)],
    ["Medium", String(diff.medium), pct(diff.medium, diffTotal)],
    ["Hard", String(diff.hard), pct(diff.hard, diffTotal)],
  ]);
  paragraph(report.difficultyAiNarrative || "—");

  heading("6. Marks Distribution");
  const marksEntries = Object.entries(report.overallMarks).sort(([a], [b]) => Number(a) - Number(b));
  table("Marks", ["Marks", "Count"], marksEntries.map(([m, c]) => [m, String(c)]));
  paragraph(report.marksAiNarrative || "—");

  heading("7. CO Coverage");
  table("Course outcomes", ["CO", "Questions", "Modules", "Coverage %"], report.coCoverage.map(c => [c.co, String(c.totalQuestions), c.modules.join(", ") || "—", `${c.coveragePct.toFixed(0)}%`]));
  paragraph(report.coCoverageAiNarrative || "—");

  heading("8. Constructive Alignment");
  paragraph(`Alignment score: ${score(report.alignmentSummary.score)}`);
  for (const risk of report.alignmentSummary.risks) paragraph(`Risk: ${risk}`);
  for (const rec of report.alignmentSummary.recommendations) paragraph(`Recommendation: ${rec}`);
  paragraph(report.alignmentAiNarrative || "—");

  heading("9. Quality Metrics");
  table("Quality", ["Module", "Clarity", "Relevance", "RBT Accuracy", "PO/PI Coverage", "Remarks"], report.qualityMetrics.map(m => [
    String(m.moduleNumber), score(m.clarity), score(m.relevance), score(m.rbtAccuracy), score(m.poPiCoverage), m.remarks || "—",
  ]));
  paragraph(report.qualityAiNarrative || "—");

  heading("10. Final Assessment");
  table("Assessments", ["Module", "Rating", "Threshold", "Strengths", "Weaknesses", "Recommendations"], report.finalAssessments.map(m => [
    String(m.moduleNumber), m.rating, score(m.threshold), m.strengths.join("; ") || "—", m.weaknesses.join("; ") || "—", m.recommendations.join("; ") || "—",
  ]));
  paragraph(report.finalAssessmentAiNarrative || "—");

  heading("11. Consolidated Scores");
  table("Scores", ["Module", "Clarity", "Relevance", "RBT Accuracy", "Completeness", "Average", "Overall"], report.consolidatedScores.map(m => [
    String(m.moduleNumber), score(m.clarity), score(m.relevance), score(m.rbtAccuracy), score(m.completeness), score(m.average), score(m.overallScore),
  ]));
  paragraph(`Overall average: ${score(report.overallAverage)}`);

  heading("12. Final Verdict");
  paragraph(`Verdict: ${report.verdict.verdict} · Overall score: ${score(report.verdict.overallScore)}`);
  paragraph(`Thresholds — Highly effective ≥ ${score(report.verdict.thresholds.highlyEffective)} · Moderately effective ≥ ${score(report.verdict.thresholds.moderatelyEffective)} · Needs revision < ${score(report.verdict.thresholds.needsRevision)}`);
  paragraph(report.verdictAiNarrative || "—");

  heading("13. Question-Level Findings");
  table("Findings", ["Slot", "Module", "Marks", "RBT", "Difficulty", "CO", "Problem", "Consequence", "Recommendation", "Confidence"], report.questionFindings.map(f => [
    f.slotId, String(f.moduleNumber), String(f.marks), f.currentRbt || "—", f.difficulty || "—", f.co || "—", f.problem, f.pedagogicalConsequence, f.recommendation, `${f.confidence}%`,
  ]));
  paragraph(report.findingsAiNarrative || "—");

  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`Evaluation · Version ${versionNumber} · Page ${i + 1} of ${pages.length}`, { x: margin, y: 18, font, size: 8 }));
  return doc.save();
}
