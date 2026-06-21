import type { EvaluationReport, DetailedEvaluationReport } from "./types";

export function formatReport(report: EvaluationReport | DetailedEvaluationReport): string {
  const lines: string[] = [
    `Overall Score: ${Math.round(report.overall)}/100`,
    ...report.categories.map((c) => `  ${c.label}: ${c.earned}/${c.max}`),
  ];

  if ("details" in report && report.details.length > 0) {
    lines.push("");
    for (const detail of report.details) {
      if (detail.explanations.length > 0) {
        for (const exp of detail.explanations) {
          lines.push(`  ${detail.label}: ${exp.message}`);
          if (exp.affectedQuestionIds.length > 0) {
            lines.push(`    Questions: ${exp.affectedQuestionIds.join(", ")}`);
          }
        }
      }
    }
  } else {
    const deductionLines = collectDeductions(report);
    if (deductionLines.length > 0) lines.push("", "Deductions:", ...deductionLines);
  }

  return lines.join("\n");
}

export function summarize(report: EvaluationReport | DetailedEvaluationReport): string {
  const lines: string[] = [`Overall: ${Math.round(report.overall)}/100`];

  if ("details" in report && report.details.length > 0) {
    for (const detail of report.details) {
      if (detail.explanations.length > 0) {
        lines.push(`  ${detail.label} (${detail.earned}/${detail.max}):`);
        for (const exp of detail.explanations) {
          lines.push(`    - ${exp.message}`);
        }
      }
    }
  } else {
    for (const c of report.categories) {
      if (c.deductions.length > 0) {
        lines.push(`  ${c.label} (${c.earned}/${c.max}):`);
        for (const d of c.deductions) lines.push(`    - ${d}`);
      }
    }
  }

  return lines.join("\n");
}

function collectDeductions(report: EvaluationReport): string[] {
  const out: string[] = [];
  for (const c of report.categories) {
    for (const d of c.deductions) out.push(`  - ${d}`);
  }
  return out;
}
