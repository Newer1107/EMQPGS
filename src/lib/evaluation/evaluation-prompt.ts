// ── Evaluation AI Prompt Builder ──────────────────────────────────
// Builds structured prompts for Ollama to generate pedagogical commentary.
// The AI NEVER computes numbers — it only explains results.

import type { EvaluationEvidence } from "./types";

// ── Prompt Version Tracking ──────────────────────────────────────
export const EVALUATION_PROMPT_VERSION = "eval-prompt-1.0.0";

export function buildEvaluationPrompt(evidence: EvaluationEvidence): string {
  return `You are an Academic Quality Auditor evaluating a question bank for a university course. Your role is to provide pedagogical analysis and recommendations.

You MUST follow these rules:
1. NEVER compute numbers yourself — the evidence already contains all metrics.
2. For EVERY remark, include: Observation → Pedagogical rationale → Recommendation.
3. Reference educational frameworks where applicable (OBE, Constructive Alignment, Revised Bloom's Taxonomy, TED, 5W1H, PEACE, OSCAR, Funneling, Pyramid Strategy, Six Thinking Hats, Five Whys).
4. Be specific — reference actual module numbers, question counts, and metrics.
5. Keep commentary concise (2-4 paragraphs per section).

## Evidence Summary

- **Total Questions**: ${evidence.totalQuestions}
- **Total Modules**: ${evidence.totalModules}
- **Total Marks**: ${evidence.totalMarks}
- **Overall Score**: ${(evidence.overallAverage * 100).toFixed(0)}%
- **Verdict**: ${evidence.verdict.verdict} (threshold: ≥${(evidence.verdict.thresholds.highlyEffective * 100).toFixed(0)}% = Highly Effective, ≥${(evidence.verdict.thresholds.moderatelyEffective * 100).toFixed(0)}% = Moderately Effective)

## Module Summaries
${evidence.moduleSummaries.map((m) => `Module ${m.moduleNumber}: ${m.filledSlots}/${m.totalSlots} slots filled, ${m.totalMarks} marks. COs: ${m.articulation}. Category: ${m.category}.`).join("\n")}

## Attribute Completeness
${evidence.completenessPerModule.map((m) => `Module ${m.moduleNumber}: ${m.completenessPct}% complete (${m.metadataComplete}/${m.totalQuestions} questions fully specified)`).join("\n")}
Overall completeness: ${evidence.overallCompleteness}%

## RBT Distribution
Overall: Remember ${evidence.rbtDistribution.remember}, Understand ${evidence.rbtDistribution.understand}, Apply ${evidence.rbtDistribution.apply}, Analyze ${evidence.rbtDistribution.analyze}, Evaluate ${evidence.rbtDistribution.evaluate}, Create ${evidence.rbtDistribution.create}
${evidence.moduleRbt.map((m) => `Module ${m.moduleNumber}: R=(${m.distribution.remember}) U=(${m.distribution.understand}) Ap=(${m.distribution.apply}) An=(${m.distribution.analyze}) E=(${m.distribution.evaluate}) C=(${m.distribution.create})`).join("\n")}

## Difficulty Distribution
Overall: Easy ${evidence.difficultyDistribution.easy}, Medium ${evidence.difficultyDistribution.medium}, Hard ${evidence.difficultyDistribution.hard}

## Marks Distribution
${Object.entries(evidence.marksDistribution).map(([marks, count]) => `${marks} marks: ${count} questions`).join("\n")}

## CO Coverage
${evidence.coCoverage.map((c) => `${c.co}: ${c.totalQuestions} questions across ${c.modules.join(", ")} modules (${c.coveragePct}% coverage)`).join("\n")}

## Constructive Alignment Score: ${(evidence.alignmentScore * 100).toFixed(0)}%

## Quality Metrics
${evidence.qualityMetrics.map((m) => `Module ${m.moduleNumber}: Clarity=${(m.clarity * 100).toFixed(0)}%, Relevance=${(m.relevance * 100).toFixed(0)}%, RBT Accuracy=${(m.rbtAccuracy * 100).toFixed(0)}%, Remarks: ${m.remarks}`).join("\n")}

## Consolidated Scores
${evidence.consolidatedScores.map((m) => `Module ${m.moduleNumber}: Average=${(m.average * 100).toFixed(0)}%`).join("\n")}

## Question-Level Findings
${evidence.questionFindings.length > 0 ? evidence.questionFindings.map((f) => `Slot ${f.slotId} (Module ${f.moduleNumber}, ${f.marks} marks): ${f.problem} → ${f.recommendation}`).join("\n") : "No issues detected."}

---

## Your Task

Provide analysis for each section in exactly the following JSON structure. Respond with valid JSON only — no markdown, no prose outside the JSON.

\`\`\`json
{
  "moduleSummaryNarrative": "Analysis of module distribution and balance...",
  "attributeNarrative": "Interpretation of metadata completeness...",
  "rbtNarrative": "Bloom's taxonomy distribution analysis...",
  "difficultyNarrative": "Difficulty progression assessment...",
  "marksNarrative": "Marks distribution assessment...",
  "coCoverageNarrative": "CO coverage analysis...",
  "alignmentNarrative": "Constructive alignment assessment...",
  "qualityNarrative": "Quality metrics interpretation...",
  "finalAssessmentNarrative": "Overall module assessment...",
  "verdictNarrative": "Final verdict explanation...",
  "findingsNarrative": "Summary of question-level issues...",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "improvementRoadmap": ["Step 1", "Step 2", "Step 3"]
}
\`\`\`
`;
}
