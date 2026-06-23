// ── Evaluation AI Prompt Builder ──────────────────────────────────
// Builds structured prompts for Ollama to generate pedagogical commentary.
// The AI NEVER computes numbers — it only explains results.
// ponytail: prompt is aggressively summarized — per-module data aggregated,
// question findings capped at 15, system boilerplate minimal.

import type { EvaluationEvidence } from "./types";

// ── Prompt Version Tracking ──────────────────────────────────────
export const EVALUATION_PROMPT_VERSION = "eval-prompt-1.1.0";

/**
 * Build a compact prompt for Ollama by aggregating per-module data and
 * capping verbose sections (question findings).  The full evidence is
 * still persisted — Ollama only gets a focused summary to stay within
 * the default 8192-token context window.
 */
export function buildEvaluationPrompt(evidence: EvaluationEvidence): string {
  const filledPct = evidence.totalQuestions > 0
    ? Math.round(evidence.moduleSummaries.filter(m => m.filledSlots > 0).length / evidence.totalModules * 100)
    : 0;

  const weakCos = evidence.coCoverage.filter(c => c.coveragePct < 50).map(c => c.co);
  const coverageNote = weakCos.length > 0
    ? `Weak coverage: ${weakCos.join(", ")}`
    : "All COs adequately covered";

  const topFindings = evidence.questionFindings.slice(0, 15);
  const extraFindings = evidence.questionFindings.length - 15;

  const rbtLines = evidence.moduleRbt.slice(0, 6).map(m =>
    `M${m.moduleNumber}: R${m.distribution.remember} U${m.distribution.understand} Ap${m.distribution.apply} An${m.distribution.analyze} E${m.distribution.evaluate} C${m.distribution.create}`
  );
  const rbtSummary = rbtLines.length > 0 ? rbtLines.join(" | ") : "No RBT data";

  return `You are an Academic Quality Auditor evaluating a question bank. Provide analysis for each section below as JSON. Be concise (1-2 paragraphs per section). Reference actual module/question counts.

## Data Summary
Questions: ${evidence.totalQuestions} | Modules: ${evidence.totalModules} | Marks: ${evidence.totalMarks}
Fill rate: ${filledPct}% | Completeness: ${evidence.overallCompleteness}%
Alignment: ${(evidence.alignmentScore * 100).toFixed(0)}% | Overall: ${(evidence.overallAverage * 100).toFixed(0)}%
Verdict: ${evidence.verdict.verdict}

## Module Summaries
${evidence.moduleSummaries.slice(0, 6).map(m => `M${m.moduleNumber}: ${m.filledSlots}/${m.totalSlots} filled, ${m.totalMarks}m, COs=${m.articulation}, ${m.category}`).join("\n")}

## RBT
Overall: R${evidence.rbtDistribution.remember} U${evidence.rbtDistribution.understand} Ap${evidence.rbtDistribution.apply} An${evidence.rbtDistribution.analyze} E${evidence.rbtDistribution.evaluate} C${evidence.rbtDistribution.create}
Per-module: ${rbtSummary}

## Difficulty: E=${evidence.difficultyDistribution.easy} M=${evidence.difficultyDistribution.medium} H=${evidence.difficultyDistribution.hard}
## CO Coverage: ${coverageNote}
## Quality: ${evidence.qualityMetrics.slice(0, 6).map(m => `M${m.moduleNumber}: C${(m.clarity*100).toFixed(0)}% R${(m.relevance*100).toFixed(0)}% RBT${(m.rbtAccuracy*100).toFixed(0)}%`).join(" | ")}
## Scores: ${evidence.consolidatedScores.slice(0, 6).map(m => `M${m.moduleNumber}: ${(m.average*100).toFixed(0)}%`).join(" | ")}

## Findings (${evidence.questionFindings.length} total)
${topFindings.length > 0 ? topFindings.map(f => `M${f.moduleNumber} ${f.marks}m: ${f.problem} → ${f.recommendation}`).join("\n") : "No issues detected."}
${extraFindings > 0 ? `...and ${extraFindings} more findings (see full report).` : ""}

---

Respond with this JSON structure only — no markdown, no prose:
{
  "moduleSummaryNarrative": "...",
  "attributeNarrative": "...",
  "rbtNarrative": "...",
  "difficultyNarrative": "...",
  "marksNarrative": "...",
  "coCoverageNarrative": "...",
  "alignmentNarrative": "...",
  "qualityNarrative": "...",
  "finalAssessmentNarrative": "...",
  "verdictNarrative": "...",
  "findingsNarrative": "...",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "improvementRoadmap": ["...", "...", "..."]
}`;
}
