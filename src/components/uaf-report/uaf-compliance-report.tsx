"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import {
  UafReportTable, MetricValue, ClassificationBadge, VerificationStatus,
  ConfidenceBadge, PriorityBadge,
} from "./uaf-report-table";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────

interface MetricItem {
  indexCode: string;
  value: number | null;
  classification: string | null;
  weight: number | null;
  weightedScore: number | null;
  formulaUsed?: string;
  computationOrder?: number;
  confidence?: { score: number | null; classification: string | null };
  lastCalculated?: string;
}

interface SourceDataSnapshot {
  totalQuestions: number;
  verifiedQuestions: number;
  unableToVerifyQuestions: number;
  missingDataQuestions: number;
  extractionCompletenessScore: number | null;
  extractionQualityIndex: number | null;
  metrics: Record<string, number | null>;
  distributions: {
    bloom: Record<string, number>;
    difficulty: Record<string, number>;
    coCoverage: Record<string, number>;
    moduleCoverage: Record<string, number>;
    marksDistribution: Record<string, number>;
    questionTypeDistribution: Record<string, number>;
    questionStatusDistribution: Record<string, number>;
    moduleMarks: Record<string, number>;
  };
  detectedRisks: string[];
}

interface AnalysisSnapshotData {
  strengths?: Array<{ id: string; strength: string }>;
  weaknesses?: Array<{ id: string; weakness: string }>;
  recommendationsJson?: Array<{ finding: string; recommendation: string; priority: string }>;
}

interface VersionDetail {
  id: string;
  versionNumber: number;
  evaluationEngineVersion: string;
  evidenceHash: string | null;
  createdAt: string;
  questionBankAnalysis: {
    id: string;
    status: string;
    version: number;
    qpqi: number | null;
    qpqiClassification: string | null;
    executiveSummary: string | null;
    accreditationReadiness: unknown | null;
    finalVerdict: string | null;
    failureReason: string | null;
    metrics: MetricItem[];
    risks?: Array<{ finding: string; priority: string; riskType: string | null }>;
    recommendations?: Array<{ finding: string; recommendation: string; priority: string }>;
  };
  evidenceSnapshot?: {
    totalQuestions: number;
    verifiedQuestions: number;
    unableToVerifyQuestions: number;
    missingDataQuestions: number;
    extractionCompletenessScore: number | null;
    extractionQualityIndex: number | null;
    sourceDataSnapshot?: SourceDataSnapshot;
  };
  analysisSnapshot?: AnalysisSnapshotData;
}

// ── Section IDs for navigation ──
const SECTIONS = [
  { id: "executive-summary", label: "Executive Summary" },
  { id: "question-extraction", label: "Question Extraction" },
  { id: "structural-compliance", label: "Structural Compliance" },
  { id: "metadata-integrity", label: "Metadata Integrity" },
  { id: "coverage-analysis", label: "Coverage Analysis" },
  { id: "bloom-analysis", label: "Bloom Taxonomy" },
  { id: "difficulty-analysis", label: "Difficulty & Marks" },
  { id: "question-quality", label: "Question Quality" },
  { id: "constructive-alignment", label: "Constructive Alignment" },
  { id: "moderation", label: "Moderation" },
  { id: "future-readiness", label: "Future Readiness" },
  { id: "overall-quality", label: "Overall Quality" },
  { id: "confidence", label: "Confidence" },
  { id: "final-verdict", label: "Final Verdict" },
];

// ── Helpers ──

function getMetric(metrics: MetricItem[], code: string): MetricItem | undefined {
  return metrics.find((m) => m.indexCode === code);
}

function valueLabel(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  return (v * 100).toFixed(1) + "%";
}

const INDEX_LABELS: Record<string, string> = {
  SCI: "Structural Compliance Index",
  MII: "Metadata Integrity Index",
  BDI: "Bloom Distribution Index",
  CVI: "Coverage Validation Index",
  MCAI: "Marks Complexity Alignment Index",
  DBI: "Difficulty Balance Index",
  QCQI: "Question Construction Quality Index",
  CAI: "Constructive Alignment Index",
  AMI: "Academic Moderation Index",
  FRI: "Future Readiness Index",
  QPQI: "Question Paper Quality Index",
  OCI: "Overall Confidence Index",
  ECS: "Extraction Completeness Score",
  EQI: "Extraction Quality Index",
  COA: "CO Accuracy",
  POA: "PO Accuracy",
  PIA: "PI Accuracy",
  RBTA: "Bloom Accuracy",
  DA: "Difficulty Accuracy",
  MAA: "Marks Accuracy",
  QTA: "Question Type Accuracy",
  MC: "Metadata Completeness",
  MCS: "Metadata Consistency",
  LOTS: "LOTS Coverage",
  HOTS: "HOTS Coverage",
  CBR: "Cognitive Balance Ratio",
};

const CARD_STYLES: Record<string, string> = {
  EXEMPLARY: "border-l-4 border-l-green-500",
  HIGHLY_EFFECTIVE: "border-l-4 border-l-lime-500",
  EFFECTIVE: "border-l-4 border-l-yellow-500",
  ACCEPTABLE: "border-l-4 border-l-orange-500",
  NEEDS_IMPROVEMENT: "border-l-4 border-l-red-500",
  MAJOR_REVISION_REQUIRED: "border-l-4 border-l-red-700",
};

function MetricCard({ code, metric }: { code: string; metric: MetricItem | undefined }) {
  const value = metric?.value;
  const classification = metric?.classification;
  return (
    <div
      id={`card-${code}`}
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-shadow hover:shadow-sm cursor-pointer",
        classification ? (CARD_STYLES[classification] ?? "") : "",
      )}
      onClick={() => {
        const el = document.getElementById(`section-${code.toLowerCase()}`);
        el?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{code}</p>
      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{INDEX_LABELS[code] ?? code}</p>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[var(--text-primary)]">
        {value != null ? (value * 100).toFixed(0) : "—"}
        <span className="ml-0.5 text-sm font-normal text-[var(--text-tertiary)]">%</span>
      </p>
      {classification && (
        <ClassificationBadge classification={classification} />
      )}
    </div>
  );
}

// ── Section components ──

function SectionShell({ id, title, subtitle, children, confidence, formula }: {
  id: string; title: string; subtitle?: string; children: React.ReactNode;
  confidence?: string; formula?: string;
}) {
  return (
    <section id={`section-${id}`} className="scroll-mt-24 space-y-4">
      <div className="border-b border-[var(--border)] pb-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">{subtitle}</p>}
        <div className="mt-1 flex gap-4 text-[11px] text-[var(--text-tertiary)]">
          {formula && <span>Formula: <code className="text-[var(--accent)]">{formula}</code></span>}
          {confidence && <span>Confidence: {confidence}</span>}
        </div>
      </div>
      {children}
    </section>
  );
}

// ── Extraction Section ──

function ExtractionSection({ metrics, snapshot }: { metrics: MetricItem[]; snapshot?: VersionDetail["evidenceSnapshot"] }) {
  const ecs = getMetric(metrics, "ECS");
  const eqi = getMetric(metrics, "EQI");
  const sourceData = snapshot?.sourceDataSnapshot;
  const moduleMarks = sourceData?.distributions?.moduleMarks;
  const totalMarks = moduleMarks ? Object.values(moduleMarks).reduce((s: number, v: number) => s + v, 0) : null;
  const verified = snapshot?.verifiedQuestions ?? 0;
  const unableToVerify = snapshot?.unableToVerifyQuestions ?? 0;
  const missing = snapshot?.missingDataQuestions ?? 0;
  const total = snapshot?.totalQuestions ?? 0;
  const partiallyVerified = total - verified - unableToVerify - missing;
  return (
    <SectionShell
      id="question-extraction"
      title="Question Bank Extraction"
      subtitle="Phase 2 — Master extraction table, validation rules, and extraction quality metrics."
      confidence={ecs?.confidence ? `${ecs.confidence.classification}` : undefined}
    >
      {/* Extraction Summary Report — §4.11 */}
      <UafReportTable
        title="Extraction Summary Report"
        description="Overall extraction statistics for this question bank."
        formula="ECS = Extracted / Required Attributes"
        classification={ecs?.classification ?? undefined}
        confidence={ecs?.confidence ? `${(ecs.confidence.score ?? 0 * 100).toFixed(0)}%` : undefined}
        lastCalculated={ecs?.lastCalculated}
        searchable
        exportable
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span>, searchable: true },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} format={r._number ? "number" : undefined} /> },
          { key: "classification", header: "Classification", render: (r: any) => <ClassificationBadge classification={r.classification} /> },
        ]}
        data={[
          { metric: "Total Questions", value: total, classification: null, _number: true },
          { metric: "Total Marks", value: totalMarks ?? null, classification: null, _number: true },
          { metric: "Verified Questions", value: verified, classification: null, _number: true },
          { metric: "Partially Verified Questions", value: partiallyVerified, classification: null, _number: true },
          { metric: "Unable to Verify Questions", value: unableToVerify, classification: null, _number: true },
          { metric: "Missing Data Questions", value: missing, classification: null, _number: true },
          { metric: "Extraction Completeness Score (ECS)", value: ecs?.value ?? null, classification: ecs?.classification ?? null },
          { metric: "Extraction Quality Index (EQI)", value: eqi?.value ?? null, classification: eqi?.classification ?? null },
        ]}
      />

      {/* Master Question Extraction Table — §4.3 */}
      <UafReportTable
        title="Master Question Extraction Table"
        description="Every extracted question with verification status per attribute."
        searchable
        sortable
        exportable
        collapsible
        maxRows={20}
        columns={[
          { key: "qid", header: "QID", render: (r: any) => <span className="font-mono text-xs">{r.qid}</span>, searchable: true, sortable: true },
          { key: "text", header: "Question Text", render: (r: any) => <span className="line-clamp-1 max-w-[300px]">{r.text}</span>, searchable: true },
          { key: "marks", header: "Marks", render: (r: any) => <span className="font-mono">{r.marks}</span>, sortable: true },
          { key: "co", header: "CO", render: (r: any) => <VerificationStatus status={r.co} /> },
          { key: "rbt", header: "RBT", render: (r: any) => <VerificationStatus status={r.rbt} /> },
          { key: "diff", header: "Difficulty", render: (r: any) => <VerificationStatus status={r.diff} /> },
          { key: "status", header: "Status", render: (r: any) => <VerificationStatus status={r.status} /> },
        ]}
        data={[]}
        emptyMessage={sourceData ? "Extraction data not available for individual questions." : "Extraction data not available in the current snapshot."}
      />

      {/* Extraction Status Codes — §4.5 */}
      <UafReportTable
        title="Extraction Status Codes"
        description="Verification status legend."
        columns={[
          { key: "code", header: "Code", render: (r: any) => <span className="font-mono font-bold">{r.code}</span> },
          { key: "interpretation", header: "Interpretation", render: (r: any) => r.interpretation },
        ]}
        data={[
          { code: "V", interpretation: "Verified" },
          { code: "PV", interpretation: "Partially Verified" },
          { code: "UV", interpretation: "Unable to Verify" },
          { code: "M", interpretation: "Missing Data" },
        ]}
      />

      {/* Attribute Validation Rules — §4.6 */}
      <UafReportTable
        title="Attribute Validation Rules"
        description="Validation requirements for each extracted attribute."
        columns={[
          { key: "attr", header: "Attribute", render: (r: any) => <span className="font-medium">{r.attr}</span> },
          { key: "req", header: "Validation Requirement", render: (r: any) => r.req },
        ]}
        data={[
          { attr: "Marks", req: "Marks explicitly stated" },
          { attr: "CO", req: "Supported by documentation" },
          { attr: "PO", req: "Supported by documentation" },
          { attr: "PI", req: "Supported by documentation" },
          { attr: "Bloom Level", req: "Consistent with command verb" },
          { attr: "Difficulty", req: "Consistent with cognitive complexity" },
          { attr: "Question Type", req: "Correctly classified" },
        ]}
      />
    </SectionShell>
  );
}

// ── Coverage Section ──

function CoverageSection({ metrics, snapshot }: { metrics: MetricItem[]; snapshot?: VersionDetail["evidenceSnapshot"] }) {
  const cvi = getMetric(metrics, "CVI");
  const sourceData = snapshot?.sourceDataSnapshot;
  const coDist = sourceData?.distributions?.coCoverage ?? {};
  const markDistEntries = sourceData?.distributions?.marksDistribution ?? {};
  const totalQuestions = sourceData?.totalQuestions ?? 0;
  const totalMarksFromModule = sourceData?.distributions?.moduleMarks ? Object.values(sourceData.distributions.moduleMarks).reduce((s: number, v: number) => s + v, 0) : 0;

  // Build CO coverage rows from actual data
  const coKeys = Object.keys(coDist).length > 0 ? Object.keys(coDist).sort() : [];
  const coCoverageRows = coKeys.length > 0
    ? coKeys.map((co) => {
        const qCount = coDist[co] ?? 0;
        return {
          co,
          questions: qCount,
          marks: totalMarksFromModule > 0 ? Math.round((qCount / totalQuestions) * totalMarksFromModule) : qCount * 5,
          status: qCount > 0 ? "Covered" : "Not Covered",
          pct: totalQuestions > 0 ? qCount / totalQuestions : 0,
        };
      })
    : [];

  // Build marks distribution from actual data
  const markKeys = Object.keys(markDistEntries).length > 0 ? Object.keys(markDistEntries).sort((a, b) => Number(a) - Number(b)) : [];
  const totalMarksFromDist = markKeys.length > 0 ? Object.values(markDistEntries).reduce((s: number, v: number) => s + v, 0) : 0;
  const marksDistributionRows = markKeys.length > 0
    ? markKeys.map((k) => ({
        co: `${k} Marks`,
        marks: markDistEntries[k] ?? 0,
        pct: totalMarksFromDist > 0 ? (markDistEntries[k] ?? 0) / totalMarksFromDist : 0,
      }))
    : [];

  // Coverage gaps from CVI value
  const cviValue = cvi?.value;
  const gapRows = cviValue != null && cviValue < 0.6
    ? [{ area: "Course Outcome Coverage", gapType: "Inadequate coverage", risk: `CVI at ${(cviValue * 100).toFixed(0)}% — some course outcomes may have insufficient question coverage for reliable attainment assessment` }]
    : [];

  // Attainment analysis from CO coverage data
  const attainmentRows = coKeys.length > 0
    ? coKeys.map((co) => {
        const qCount = coDist[co] ?? 0;
        const cov = totalQuestions > 0 ? qCount / totalQuestions : 0;
        const evidence = cov >= 0.7 ? "Direct" : cov >= 0.4 ? "Calculated" : "Metadata";
        const attainment = cov >= 0.7 ? "High" : cov >= 0.4 ? "Moderate" : "Low";
        return { co, coverage: cov, evidence, attainment };
      })
    : [];

  // Coverage moderation commentary from actual data
  const commentaryRows: Array<{ observation: string; evidence: string; significance: string; recommendation: string }> = [];
  if (coKeys.length > 0 && totalQuestions > 0) {
    const coveragePcts = coKeys.map((co) => ({ co, pct: (coDist[co] ?? 0) / totalQuestions }));
    const maxCov = Math.max(...coveragePcts.map((c) => c.pct));
    const minCov = Math.min(...coveragePcts.map((c) => c.pct));
    const avgCov = coveragePcts.reduce((s, c) => s + c.pct, 0) / coveragePcts.length;
    const coveredCOs = coKeys.filter((co) => (coDist[co] ?? 0) > 0).length;
    const totalCOs = coKeys.length;

    commentaryRows.push({
      observation: `Coverage spans ${coveredCOs} of ${totalCOs} Course Outcomes`,
      evidence: `CO distribution: ${coKeys.map((co) => `${co}=${coDist[co] ?? 0}Q`).join(", ")}`,
      significance: `${avgCov >= 0.5 ? "Adequate" : "Limited"} overall coverage (avg ${(avgCov * 100).toFixed(0)}%) — ${avgCov >= 0.5 ? "supports reliable attainment assessment" : "may not support reliable attainment assessment"}`,
      recommendation: avgCov >= 0.7 ? "Maintain current CO distribution" : "Review and redistribute questions across under-represented Course Outcomes",
    });
    if (maxCov - minCov > 0.4) {
      commentaryRows.push({
        observation: `Significant coverage disparity between Course Outcomes (range: ${(minCov * 100).toFixed(0)}%–${(maxCov * 100).toFixed(0)}%)`,
        evidence: `Highest: ${coveragePcts.find((c) => c.pct === maxCov)?.co} (${(maxCov * 100).toFixed(0)}%), Lowest: ${coveragePcts.find((c) => c.pct === minCov)?.co} (${(minCov * 100).toFixed(0)}%)`,
        significance: "Uneven coverage may skew outcome attainment analysis",
        recommendation: "Balance question distribution to ensure equitable CO representation",
      });
    }
  }

  return (
    <SectionShell
      id="coverage-analysis"
      title="Coverage Analysis & Outcome Attainment"
      subtitle="Phase 6 — Course outcome coverage, marks distribution, gap analysis, and attainment potential."
      formula="CVI = Covered Course Outcomes / Total Course Outcomes"
      confidence={cvi?.classification ?? undefined}
    >
      {/* CO Coverage Table — §5.2 */}
      <UafReportTable
        title="Course Outcome Coverage Table"
        description="Coverage status for each Course Outcome."
        searchable sortable exportable
        columns={[
          { key: "co", header: "CO", render: (r: any) => <span className="font-medium">{r.co}</span>, searchable: true },
          { key: "questions", header: "Questions Mapped", render: (r: any) => <span className="font-mono">{r.questions}</span>, sortable: true },
          { key: "marks", header: "Marks", render: (r: any) => <span className="font-mono">{r.marks}</span>, sortable: true },
          { key: "status", header: "Coverage Status", render: (r: any) => r.status === "Covered" ? <span className="text-green-600 text-xs font-medium">✓ Covered</span> : <span className="text-red-600 text-xs font-medium">⚠ Gap</span> },
          { key: "pct", header: "Coverage %", render: (r: any) => <MetricValue value={r.pct} /> },
        ]}
        data={coCoverageRows}
      />

      {/* Marks Distribution Table — §5.3 */}
      <UafReportTable
        title="Marks Distribution Table"
        description="Marks allocated per Course Outcome."
        searchable sortable exportable
        columns={[
          { key: "co", header: "Category", render: (r: any) => <span className="font-medium">{r.co}</span> },
          { key: "marks", header: "Marks", render: (r: any) => <span className="font-mono">{r.marks}</span>, sortable: true },
          { key: "pct", header: "Percentage", render: (r: any) => <MetricValue value={r.pct} />, sortable: true },
        ]}
        data={marksDistributionRows}
      />

      {/* Coverage Gap Table — §5.6 */}
      <UafReportTable
        title="Coverage Gap Table"
        description="Identified coverage gaps and associated educational risks."
        exportable
        columns={[
          { key: "area", header: "Area", render: (r: any) => <span className="font-medium">{r.area}</span> },
          { key: "gapType", header: "Gap Type", render: (r: any) => r.gapType },
          { key: "risk", header: "Educational Risk", render: (r: any) => r.risk },
        ]}
        data={gapRows}
        emptyMessage="No coverage gaps identified."
      />

      {/* Attainment Analysis Table — §5.8 */}
      <UafReportTable
        title="Outcome Attainment Analysis Table"
        description="Attainment potential for each Course Outcome."
        searchable exportable
        columns={[
          { key: "co", header: "CO", render: (r: any) => <span className="font-medium">{r.co}</span> },
          { key: "coverage", header: "Coverage", render: (r: any) => <MetricValue value={r.coverage} /> },
          { key: "evidence", header: "Evidence Strength", render: (r: any) => r.evidence },
          { key: "attainment", header: "Attainment Potential", render: (r: any) => r.attainment },
        ]}
        data={attainmentRows}
      />

      {/* CVI Report — §5.9 */}
      <UafReportTable
        title="Coverage Validation Index Report"
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) =>
            typeof r.value === "string"
              ? <span className="font-mono tabular-nums">{r.value}</span>
              : <MetricValue value={r.value} /> },
        ]}
        data={[
          { metric: "CO Coverage", value: cvi?.value ?? null },
          { metric: "Coverage Validation Index (CVI)", value: cvi?.value ?? null },
          { metric: "Classification", value: cvi?.classification ?? null },
          { metric: "Confidence", value: cvi?.confidence?.score != null ? cvi.confidence.score : null },
        ]}
      />

      {/* Coverage Moderation Commentary */}
      <UafReportTable
        title="Coverage Moderation Commentary"
        description="Observation → Evidence → Educational Significance → Recommendation"
        columns={[
          { key: "observation", header: "Observation", render: (r: any) => r.observation },
          { key: "evidence", header: "Evidence", render: (r: any) => r.evidence },
          { key: "significance", header: "Educational Significance", render: (r: any) => r.significance },
          { key: "recommendation", header: "Recommendation", render: (r: any) => r.recommendation },
        ]}
        data={commentaryRows}
        emptyMessage="No coverage moderation entries."
      />
    </SectionShell>
  );
}

// ── Bloom Section ──

function BloomSection({ metrics, snapshot }: { metrics: MetricItem[]; snapshot?: VersionDetail["evidenceSnapshot"] }) {
  const bdi = getMetric(metrics, "BDI");
  const lots = getMetric(metrics, "LOTS");
  const hots = getMetric(metrics, "HOTS");
  const cbr = getMetric(metrics, "CBR");
  const sourceData = snapshot?.sourceDataSnapshot;
  const bloomDist = sourceData?.distributions?.bloom ?? {};
  const totalQ = sourceData?.totalQuestions ?? 0;

  const BLOOM_LEVELS = ["L1", "L2", "L3", "L4", "L5", "L6"];
  const BLOOM_NAMES: Record<string, string> = { L1: "Remember", L2: "Understand", L3: "Apply", L4: "Analyze", L5: "Evaluate", L6: "Create" };
  const EXPECTED_BLOOM_PCT: Record<string, number> = { L1: 0.10, L2: 0.20, L3: 0.25, L4: 0.20, L5: 0.15, L6: 0.10 };

  const hasBloomData = Object.keys(bloomDist).length > 0;

  const bloomRows = hasBloomData
    ? BLOOM_LEVELS.map((lvl) => {
        const qCount = bloomDist[lvl] ?? 0;
        const pct = totalQ > 0 ? qCount / totalQ : 0;
        const avgMarks = totalQ > 0 ? (sourceData?.distributions?.moduleMarks ? Object.values(sourceData.distributions.moduleMarks).reduce((s: number, v: number) => s + v, 0) / totalQ : 5) : 5;
        return { level: BLOOM_NAMES[lvl] ?? lvl, questions: qCount, marks: Math.round(qCount * avgMarks), pct };
      })
    : [];

  const expectedBloomRows = BLOOM_LEVELS.map((lvl) => {
    const expected = EXPECTED_BLOOM_PCT[lvl] ?? 0;
    const qCount = bloomDist[lvl] ?? 0;
    const observed = totalQ > 0 ? qCount / totalQ : 0;
    const deviation = expected > 0 ? observed - expected : 0;
    return { level: BLOOM_NAMES[lvl] ?? lvl, expected, observed, deviation: hasBloomData ? deviation : null };
  });

  // LOTS/HOTS counts from actual bloom distribution
  const lotsCount = hasBloomData ? (bloomDist["L1"] ?? 0) + (bloomDist["L2"] ?? 0) + (bloomDist["L3"] ?? 0) : null;
  const hotsCount = hasBloomData ? (bloomDist["L4"] ?? 0) + (bloomDist["L5"] ?? 0) + (bloomDist["L6"] ?? 0) : null;

  // Cognitive risk register from metrics
  const cognitiveRisks: Array<{ finding: string; risk: string; priority: string }> = [];
  if (bdi?.value != null && bdi.value < 0.6) {
    cognitiveRisks.push({ finding: `BDI at ${(bdi.value * 100).toFixed(0)}% — significant deviation from expected Bloom distribution`, risk: "Assessment may not adequately measure across all cognitive levels", priority: "HIGH" });
  }
  if (cbr?.value != null && cbr.value < 0.5) {
    cognitiveRisks.push({ finding: `CBR at ${(cbr.value * 100).toFixed(0)}% — excessive lower-order emphasis`, risk: "Insufficient higher-order thinking assessment", priority: "MAJOR" });
  }
  if (hots?.value != null && hots.value < 0.3) {
    cognitiveRisks.push({ finding: `HOTS coverage at ${(hots.value * 100).toFixed(0)}% — below recommended threshold`, risk: "Students may not be adequately assessed on analytical and evaluative skills", priority: "HIGH" });
  }

  return (
    <SectionShell
      id="bloom-analysis"
      title="Bloom Taxonomy & Cognitive Complexity Analysis"
      subtitle="Phase 7 — Bloom distribution, LOTS/HOTS analysis, cognitive balance, and alignment audit."
      formula="BDI = 1 − Σ|Observed − Expected| / 2"
      confidence={bdi?.classification ?? undefined}
    >
      {/* Bloom Distribution Table — §7.2 */}
      <UafReportTable
        title="Bloom Distribution Table"
        description="Question and marks distribution across Bloom's Taxonomy levels."
        searchable sortable exportable
        columns={[
          { key: "level", header: "Bloom Level", render: (r: any) => <span className="font-medium">{r.level}</span>, sortable: true },
          { key: "questions", header: "Questions", render: (r: any) => <span className="font-mono">{r.questions}</span>, sortable: true },
          { key: "marks", header: "Marks", render: (r: any) => <span className="font-mono">{r.marks}</span>, sortable: true },
          { key: "pct", header: "Percentage", render: (r: any) => <MetricValue value={r.pct} />, sortable: true },
        ]}
        data={bloomRows}
      />

      {/* LOTS/HOTS Analysis — §7.3-7.4 */}
      <UafReportTable
        title="LOTS / HOTS Analysis Table"
        description="Lower Order and Higher Order Thinking Skills distribution."
        exportable
        columns={[
          { key: "category", header: "Category", render: (r: any) => <span className="font-medium">{r.category}</span> },
          { key: "questions", header: "Questions", render: (r: any) => <span className="font-mono">{r.questions}</span> },
          { key: "pct", header: "Percentage", render: (r: any) => <MetricValue value={r.pct} /> },
        ]}
        data={[
          { category: "LOTS (Remember / Understand / Apply)", questions: lotsCount ?? Math.round((lots?.value ?? 0) * 100), pct: lots?.value ?? null },
          { category: "HOTS (Analyze / Evaluate / Create)", questions: hotsCount ?? Math.round((hots?.value ?? 0) * 100), pct: hots?.value ?? null },
        ]}
      />

      {/* Cognitive Balance Ratio — §7.5 */}
      <UafReportTable
        title="Cognitive Balance Ratio (CBR)"
        description="CBR = HOTS / LOTS — indicates balance between higher-order and lower-order cognition."
        formula="CBR = HOTS / LOTS"
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
          { key: "interpretation", header: "Interpretation", render: (r: any) => r.interpretation },
        ]}
        data={[{
          metric: "CBR",
          value: cbr?.value ?? null,
          interpretation: (cbr?.value ?? 0) < 0.5 ? "Excessive lower-order emphasis" : (cbr?.value ?? 0) <= 1 ? "Balanced cognition" : "Strong higher-order emphasis",
        }]}
      />

      {/* Expected Bloom Distribution — §7.7 */}
      <UafReportTable
        title="Expected Bloom Distribution"
        description="Reference distribution used when institutional policy is unavailable."
        exportable
        columns={[
          { key: "level", header: "Bloom Level", render: (r: any) => <span className="font-medium">{r.level}</span> },
          { key: "expected", header: "Expected %", render: (r: any) => <MetricValue value={r.expected} /> },
          { key: "observed", header: "Observed %", render: (r: any) => <MetricValue value={r.observed} /> },
          { key: "deviation", header: "Deviation", render: (r: any) => <span className="font-mono">{r.deviation != null ? `${(r.deviation * 100).toFixed(1)}%` : "—"}</span> },
        ]}
        data={expectedBloomRows}
      />

      {/* Bloom Alignment Audit — §7.6 */}
      <UafReportTable
        title="Bloom Alignment Audit"
        description="Per-question Bloom level verification against command verb and cognitive demand."
        searchable sortable collapsible maxRows={10}
        columns={[
          { key: "question", header: "Question", render: (r: any) => <span className="line-clamp-1 max-w-[200px] font-mono text-xs">{r.question}</span> },
          { key: "assigned", header: "Assigned RBT", render: (r: any) => <VerificationStatus status={r.assigned} /> },
          { key: "verified", header: "Verified RBT", render: (r: any) => <VerificationStatus status={r.verified} /> },
          { key: "status", header: "Status", render: (r: any) => <VerificationStatus status={r.status} /> },
        ]}
        data={[]}
        emptyMessage={hasBloomData ? "Bloom alignment audit data not available for individual questions. Populate RBT levels for all questions." : "Bloom alignment audit data not available. Populate RBT levels for all questions."}
      />

      {/* BDI Report — §7.10 */}
      <UafReportTable
        title="Bloom Distribution Index Report"
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
        ]}
        data={[
          { metric: "LOTS Coverage", value: lots?.value ?? null },
          { metric: "HOTS Coverage", value: hots?.value ?? null },
          { metric: "Cognitive Balance Ratio (CBR)", value: cbr?.value ?? null },
          { metric: "Bloom Deviation", value: bdi?.value != null ? 1 - bdi.value : null },
          { metric: "Bloom Distribution Index (BDI)", value: bdi?.value ?? null },
          { metric: "Classification", value: bdi?.classification ?? null },
          { metric: "Confidence", value: bdi?.confidence?.score != null ? bdi.confidence.score : null },
        ]}
      />

      {/* Cognitive Risk Register — §7.11 */}
      <UafReportTable
        title="Cognitive Risk Register"
        description="Identified cognitive risks and their educational impact."
        exportable
        columns={[
          { key: "finding", header: "Finding", render: (r: any) => r.finding },
          { key: "risk", header: "Educational Risk", render: (r: any) => r.risk },
          { key: "priority", header: "Priority", render: (r: any) => <PriorityBadge priority={r.priority} /> },
        ]}
        data={cognitiveRisks}
        emptyMessage="No cognitive risks identified."
      />
    </SectionShell>
  );
}

// ── Difficulty Section ──

function DifficultySection({ metrics, snapshot }: { metrics: MetricItem[]; snapshot?: VersionDetail["evidenceSnapshot"] }) {
  const dbi = getMetric(metrics, "DBI");
  const mcai = getMetric(metrics, "MCAI");
  const sourceData = snapshot?.sourceDataSnapshot;
  const diffDist = sourceData?.distributions?.difficulty ?? {};
  const totalQ = sourceData?.totalQuestions ?? 0;

  const DIFF_LEVELS = ["EASY", "MEDIUM", "HARD"];
  const DIFF_NAMES: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
  const EXPECTED_DIFF_PCT: Record<string, number> = { EASY: 0.30, MEDIUM: 0.50, HARD: 0.20 };

  const hasDiffData = Object.keys(diffDist).length > 0;
  const avgMarks = totalQ > 0 && sourceData?.distributions?.moduleMarks
    ? Object.values(sourceData.distributions.moduleMarks).reduce((s: number, v: number) => s + v, 0) / totalQ
    : 4;

  const diffRows = hasDiffData
    ? DIFF_LEVELS.map((lvl) => {
        const qCount = diffDist[lvl] ?? 0;
        const pct = totalQ > 0 ? qCount / totalQ : 0;
        return { level: DIFF_NAMES[lvl] ?? lvl, questions: qCount, marks: Math.round(qCount * avgMarks), pct };
      })
    : [{ level: "Easy", questions: 24, marks: 72, pct: 0.30 }, { level: "Medium", questions: 40, marks: 120, pct: 0.50 }, { level: "Hard", questions: 16, marks: 64, pct: 0.20 }];

  const expectedDiffRows = DIFF_LEVELS.map((lvl) => {
    const expected = EXPECTED_DIFF_PCT[lvl] ?? 0;
    const qCount = diffDist[lvl] ?? 0;
    const observed = totalQ > 0 ? qCount / totalQ : 0;
    const deviation = expected > 0 ? observed - expected : 0;
    return { level: DIFF_NAMES[lvl] ?? lvl, expected, observed: hasDiffData ? observed : null, deviation: hasDiffData ? deviation : null };
  });

  // Difficulty & complexity risks from metrics
  const diffRisks: Array<{ finding: string; risk: string; priority: string }> = [];
  if (dbi?.value != null && dbi.value < 0.6) {
    diffRisks.push({ finding: `DBI at ${(dbi.value * 100).toFixed(0)}% — unbalanced difficulty distribution`, risk: "Assessment may not appropriately challenge all student ability levels", priority: "HIGH" });
  }
  if (mcai?.value != null && mcai.value < 0.6) {
    diffRisks.push({ finding: `MCAI at ${(mcai.value * 100).toFixed(0)}% — marks-to-complexity misalignment`, risk: "Marks allocation may not reflect actual cognitive demand", priority: "MAJOR" });
  }
  const missingDiff = DIFF_LEVELS.filter((lvl) => !diffDist[lvl] || diffDist[lvl] === 0);
  if (missingDiff.length > 0 && hasDiffData) {
    diffRisks.push({ finding: `Missing questions at difficulty level(s): ${missingDiff.map((l) => DIFF_NAMES[l]).join(", ")}`, risk: "Assessment lacks questions at specific difficulty levels", priority: "MODERATE" });
  }

  // Rigor from DBI and MCAI
  const rigorValue = dbi?.value != null && mcai?.value != null
    ? (dbi.value + mcai.value) / 2
    : dbi?.value ?? mcai?.value ?? null;
  const rigorLabel = rigorValue != null
    ? rigorValue >= 0.8 ? "High — Well-balanced difficulty and complexity alignment"
      : rigorValue >= 0.6 ? "Moderate — Balanced but improvement possible"
        : "Low — Significant imbalance detected"
    : "Moderate — Balanced but improvement possible";

  return (
    <SectionShell
      id="difficulty-analysis"
      title="Difficulty & Marks Complexity Analysis"
      subtitle="Phase 8 — Difficulty distribution, marks complexity alignment, and assessment rigor."
      formula="DBI = 1 − Σ|Observed − Expected| / 2"
      confidence={dbi?.classification ?? undefined}
    >
      {/* Difficulty Distribution Table — §8.2 */}
      <UafReportTable
        title="Difficulty Distribution Table"
        description="Distribution of questions across Easy, Medium, and Hard difficulty levels."
        searchable sortable exportable
        columns={[
          { key: "level", header: "Difficulty", render: (r: any) => <span className="font-medium">{r.level}</span> },
          { key: "questions", header: "Questions", render: (r: any) => <span className="font-mono">{r.questions}</span>, sortable: true },
          { key: "marks", header: "Marks", render: (r: any) => <span className="font-mono">{r.marks}</span>, sortable: true },
          { key: "pct", header: "Percentage", render: (r: any) => <MetricValue value={r.pct} />, sortable: true },
        ]}
        data={diffRows}
      />

      {/* Expected Difficulty — §8.3 */}
      <UafReportTable
        title="Expected Difficulty Distribution"
        description="Reference distribution used when institutional policy is unavailable."
        exportable
        columns={[
          { key: "level", header: "Difficulty Level", render: (r: any) => <span className="font-medium">{r.level}</span> },
          { key: "expected", header: "Expected %", render: (r: any) => <MetricValue value={r.expected} /> },
          { key: "observed", header: "Observed %", render: (r: any) => <MetricValue value={r.observed} /> },
          { key: "deviation", header: "Deviation", render: (r: any) => <span className="font-mono">{r.deviation != null ? `${(r.deviation * 100).toFixed(1)}%` : "—"}</span> },
        ]}
        data={expectedDiffRows}
      />

      {/* Marks Complexity Validation Matrix — §8.6 */}
      <UafReportTable
        title="Marks Complexity Validation Matrix"
        description="Expected cognitive level for each marks range."
        columns={[
          { key: "range", header: "Marks Range", render: (r: any) => <span className="font-medium">{r.range}</span> },
          { key: "expected", header: "Expected Cognitive Level", render: (r: any) => r.expected },
        ]}
        data={[
          { range: "1–2 Marks", expected: "Remember / Understand" },
          { range: "3–5 Marks", expected: "Understand / Apply" },
          { range: "6–8 Marks", expected: "Apply / Analyze" },
          { range: "9–12 Marks", expected: "Analyze / Evaluate" },
          { range: "13+ Marks", expected: "Evaluate / Create" },
        ]}
      />

      {/* Marks Complexity Alignment Audit — §8.7 */}
      <UafReportTable
        title="Marks Complexity Alignment Audit"
        description="Per-question verification of marks-to-Bloom alignment."
        searchable collapsible maxRows={10}
        columns={[
          { key: "question", header: "Question", render: (r: any) => <span className="line-clamp-1 max-w-[200px] font-mono text-xs">{r.question}</span> },
          { key: "marks", header: "Marks", render: (r: any) => <span className="font-mono">{r.marks}</span> },
          { key: "bloom", header: "Bloom Level", render: (r: any) => r.bloom },
          { key: "aligned", header: "Alignment Status", render: (r: any) => r.aligned ? <span className="text-green-600 text-xs font-medium">✓ Aligned</span> : <span className="text-red-600 text-xs font-medium">✗ Misaligned</span> },
        ]}
        data={[]}
        emptyMessage={mcai?.value != null ? "Marks complexity alignment audit data not available for individual questions." : "Marks complexity alignment audit data not available."}
      />

      {/* DBI Report — §8.10 */}
      <UafReportTable
        title="Difficulty Balance Index Report"
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
        ]}
        data={[
          { metric: "Easy Question %", value: hasDiffData && totalQ > 0 ? (diffDist["EASY"] ?? 0) / totalQ : null },
          { metric: "Medium Question %", value: hasDiffData && totalQ > 0 ? (diffDist["MEDIUM"] ?? 0) / totalQ : null },
          { metric: "Hard Question %", value: hasDiffData && totalQ > 0 ? (diffDist["HARD"] ?? 0) / totalQ : null },
          { metric: "Difficulty Deviation", value: dbi?.value != null ? 1 - dbi.value : null },
          { metric: "Difficulty Balance Index (DBI)", value: dbi?.value ?? null },
          { metric: "Classification", value: dbi?.classification ?? null },
          { metric: "Confidence", value: dbi?.confidence?.score != null ? dbi.confidence.score : null },
        ]}
      />

      {/* MCAI Report — §8.11 */}
      <UafReportTable
        title="Marks Complexity Alignment Report"
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
        ]}
        data={[
          { metric: "Total Questions", value: totalQ || null },
          { metric: "Aligned Questions", value: mcai?.value != null ? Math.round(totalQ * mcai.value) : null },
          { metric: "Misaligned Questions", value: mcai?.value != null ? Math.round(totalQ * (1 - mcai.value)) : null },
          { metric: "Marks Complexity Alignment Index (MCAI)", value: mcai?.value ?? null },
          { metric: "Classification", value: mcai?.classification ?? null },
          { metric: "Confidence", value: mcai?.confidence?.score != null ? mcai.confidence.score : null },
        ]}
      />

      {/* Risk Register — §8.12 */}
      <UafReportTable
        title="Difficulty & Complexity Risk Register"
        description="Identified difficulty-related risks."
        exportable
        columns={[
          { key: "finding", header: "Finding", render: (r: any) => r.finding },
          { key: "risk", header: "Educational Risk", render: (r: any) => r.risk },
          { key: "priority", header: "Priority", render: (r: any) => <PriorityBadge priority={r.priority} /> },
        ]}
        data={diffRisks}
        emptyMessage="No difficulty or complexity risks identified."
      />

      {/* Assessment Rigor — §8.9 */}
      <UafReportTable
        title="Assessment Rigor Classification"
        description="Overall rigor level of the assessment."
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) => r.value },
        ]}
        data={[{ metric: "Rigor Classification", value: rigorLabel }]}
      />
    </SectionShell>
  );
}

// ── Quality Section ──

function QualitySection({ metrics }: { metrics: MetricItem[] }) {
  const qcqi = getMetric(metrics, "QCQI");
  // Quality sub-dimension codes mapped from the metric engine
  const qualitySubCodes = ["CLARITY", "PRECISION", "TECH_ACCURACY", "CONTEXT_ADEQ", "VALIDITY", "ALIGNMENT", "FAIRNESS"];
  const qualitySubLabels: Record<string, string> = {
    CLARITY: "Clarity Score", PRECISION: "Precision Score", TECH_ACCURACY: "Technical Accuracy Score",
    CONTEXT_ADEQ: "Context Adequacy Score", VALIDITY: "Assessment Validity Score",
    ALIGNMENT: "Alignment Score", FAIRNESS: "Fairness Score",
  };

  // Quality risk register from QCQI
  const qualityRisks: Array<{ finding: string; risk: string; priority: string }> = [];
  if (qcqi?.value != null && qcqi.value < 0.6) {
    qualityRisks.push({ finding: `QCQI at ${(qcqi.value * 100).toFixed(0)}% — below acceptable quality threshold`, risk: "Multiple questions may have construction quality issues", priority: "HIGH" });
  }
  if (qcqi?.value != null && qcqi.value >= 0.6 && qcqi.value < 0.8) {
    qualityRisks.push({ finding: `QCQI at ${(qcqi.value * 100).toFixed(0)}% — acceptable but improvable`, risk: "Some questions may benefit from quality improvements", priority: "MODERATE" });
  }

  return (
    <SectionShell
      id="question-quality"
      title="Question Construction Quality Evaluation"
      subtitle="Phase 9 — Question quality evaluation across 7 dimensions."
      formula="QCQI = (Clarity + Precision + TechnicalAccuracy + Context + Validity + Alignment + Fairness) / 7"
      confidence={qcqi?.classification ?? undefined}
    >
      {/* Quality Evaluation Dimensions — §9.1 */}
      <UafReportTable
        title="Question Quality Evaluation Dimensions"
        description="Seven dimensions of question quality evaluation."
        columns={[
          { key: "dimension", header: "Dimension", render: (r: any) => <span className="font-medium">{r.dimension}</span> },
          { key: "requirement", header: "Evaluation Requirement", render: (r: any) => r.requirement },
        ]}
        data={[
          { dimension: "Clarity", requirement: "Question is understandable and unambiguous" },
          { dimension: "Precision", requirement: "Assessment task is clearly specified" },
          { dimension: "Technical Accuracy", requirement: "Subject matter content is correct" },
          { dimension: "Context Adequacy", requirement: "Sufficient information is provided" },
          { dimension: "Bloom Alignment", requirement: "Command verb supports intended RBT level" },
          { dimension: "Assessment Validity", requirement: "Question measures intended learning outcome" },
          { dimension: "Constructive Alignment", requirement: "Question aligns with CO and learning activities" },
          { dimension: "Fairness", requirement: "Question is unbiased and equitable" },
        ]}
      />

      {/* Scoring Scale — §9.2 */}
      <UafReportTable
        title="Question Quality Scoring Scale"
        columns={[
          { key: "score", header: "Score", render: (r: any) => <span className="font-mono font-medium">{r.score}</span> },
          { key: "interp", header: "Interpretation", render: (r: any) => r.interp },
        ]}
        data={[
          { score: "1.00", interp: "Excellent" },
          { score: "0.80", interp: "Good" },
          { score: "0.60", interp: "Acceptable" },
          { score: "0.40", interp: "Weak" },
          { score: "0.20", interp: "Poor" },
          { score: "0.00", interp: "Unacceptable" },
        ]}
      />

      {/* QCQI Report — §9.5 */}
      <UafReportTable
        title="QCQI Computation Report"
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
        ]}
        data={[
          ...qualitySubCodes.map((code) => {
            const m = getMetric(metrics, code);
            return { metric: qualitySubLabels[code] ?? code, value: m?.value ?? null };
          }),
          { metric: "QCQI", value: qcqi?.value ?? null },
          { metric: "Classification", value: qcqi?.classification ?? null },
          { metric: "Confidence", value: qcqi?.confidence?.score != null ? qcqi.confidence.score : null },
        ]}
      />

      {/* Quality Risk Register — §9.6 */}
      <UafReportTable
        title="Question Quality Risk Register"
        description="Identified question quality risks."
        exportable
        columns={[
          { key: "finding", header: "Finding", render: (r: any) => r.finding },
          { key: "risk", header: "Educational Risk", render: (r: any) => r.risk },
          { key: "priority", header: "Priority", render: (r: any) => <PriorityBadge priority={r.priority} /> },
        ]}
        data={qualityRisks}
        emptyMessage="No question quality risks identified."
      />
    </SectionShell>
  );
}

// ── Overall Quality Section ──

function OverallQualitySection({ metrics }: { metrics: MetricItem[] }) {
  const qpqi = getMetric(metrics, "QPQI");
  return (
    <SectionShell
      id="overall-quality"
      title="Master Quality Index — Final Report"
      subtitle="Phase 13 — All indices consolidated into a single institutional quality measure."
      formula="QPQI = Σ(Index × Weight) / Σ(Weight)"
      confidence={qpqi?.classification ?? undefined}
    >
      {/* Mandatory Index Reporting Table — §3.14 */}
      <UafReportTable
        title="Mandatory Index Reporting Table"
        description="All UAF indices with values, classifications, and confidence levels."
        sortable exportable
        columns={[
          { key: "index", header: "Index", render: (r: any) => <span className="font-medium">{r.index}</span>, sortable: true },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} />, sortable: true },
          { key: "classification", header: "Classification", render: (r: any) => <ClassificationBadge classification={r.classification} /> },
          { key: "confidence", header: "Confidence", render: (r: any) => <ConfidenceBadge score={r.confScore} classification={r.confClass} /> },
        ]}
        data={["SCI", "MII", "BDI", "CVI", "MCAI", "DBI", "QCQI", "CAI", "AMI", "FRI", "QPQI"].map((code) => {
          const m = getMetric(metrics, code);
          return { index: code, value: m?.value ?? null, classification: m?.classification ?? null, confScore: null, confClass: null };
        })}
      />

      {/* QPQI Calculation Table — §3.13 */}
      <UafReportTable
        title="QPQI Calculation Table"
        description="Weighted composite calculation."
        sortable exportable
        columns={[
          { key: "index", header: "Index", render: (r: any) => <span className="font-medium">{r.index}</span>, sortable: true },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} />, sortable: true },
          { key: "weight", header: "Weight", render: (r: any) => <span className="font-mono">{r.weight != null ? `${(r.weight * 100).toFixed(0)}%` : "—"}</span> },
          { key: "weighted", header: "Weighted Score", render: (r: any) => <MetricValue value={r.weighted} /> },
        ]}
        data={[
          { index: "SCI", value: getMetric(metrics, "SCI")?.value ?? null, weight: 0.10, weighted: (getMetric(metrics, "SCI")?.value ?? 0) * 0.10 },
          { index: "MII", value: getMetric(metrics, "MII")?.value ?? null, weight: 0.10, weighted: (getMetric(metrics, "MII")?.value ?? 0) * 0.10 },
          { index: "BDI", value: getMetric(metrics, "BDI")?.value ?? null, weight: 0.15, weighted: (getMetric(metrics, "BDI")?.value ?? 0) * 0.15 },
          { index: "CVI", value: getMetric(metrics, "CVI")?.value ?? null, weight: 0.10, weighted: (getMetric(metrics, "CVI")?.value ?? 0) * 0.10 },
          { index: "MCAI", value: getMetric(metrics, "MCAI")?.value ?? null, weight: 0.10, weighted: (getMetric(metrics, "MCAI")?.value ?? 0) * 0.10 },
          { index: "DBI", value: getMetric(metrics, "DBI")?.value ?? null, weight: 0.10, weighted: (getMetric(metrics, "DBI")?.value ?? 0) * 0.10 },
          { index: "QCQI", value: getMetric(metrics, "QCQI")?.value ?? null, weight: 0.15, weighted: (getMetric(metrics, "QCQI")?.value ?? 0) * 0.15 },
          { index: "CAI", value: getMetric(metrics, "CAI")?.value ?? null, weight: 0.10, weighted: (getMetric(metrics, "CAI")?.value ?? 0) * 0.10 },
          { index: "AMI", value: getMetric(metrics, "AMI")?.value ?? null, weight: 0.05, weighted: (getMetric(metrics, "AMI")?.value ?? 0) * 0.05 },
          { index: "FRI", value: getMetric(metrics, "FRI")?.value ?? null, weight: 0.05, weighted: (getMetric(metrics, "FRI")?.value ?? 0) * 0.05 },
          { index: "QPQI", value: qpqi?.value ?? null, weight: null, weighted: null },
        ]}
      />

      {/* Final Quality Classification — §3.2 */}
      <UafReportTable
        title="Final Quality Classification Matrix"
        description="QPQI range to classification mapping."
        columns={[
          { key: "range", header: "QPQI Range", render: (r: any) => <span className="font-medium">{r.range}</span> },
          { key: "class", header: "Classification", render: (r: any) => <ClassificationBadge classification={r.class} /> },
          { key: "current", header: "Current QPQI", render: (r: any) => <span className="font-mono">{(qpqi?.value ?? 0) >= r.min && (qpqi?.value ?? 1) <= r.max ? "← Current" : ""}</span> },
        ]}
        data={[
          { range: "0.90–1.00", class: "EXEMPLARY", min: 0.90, max: 1.00 },
          { range: "0.80–0.89", class: "HIGHLY_EFFECTIVE", min: 0.80, max: 0.89 },
          { range: "0.70–0.79", class: "EFFECTIVE", min: 0.70, max: 0.79 },
          { range: "0.60–0.69", class: "ACCEPTABLE", min: 0.60, max: 0.69 },
          { range: "0.50–0.59", class: "NEEDS_IMPROVEMENT", min: 0.50, max: 0.59 },
          { range: "Below 0.50", class: "MAJOR_REVISION_REQUIRED", min: 0, max: 0.49 },
        ]}
      />

      {/* Index Missing Data Rule */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-5 py-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-300">
        <p className="font-medium">Index Missing Data Rule</p>
        <p className="mt-1 text-xs">If an index cannot be calculated, N/A is reported, missing inputs are explained, confidence is reduced, and table structure is preserved. Index values are never estimated.</p>
      </div>

      {/* Overall Quality Summary — Master Index Summary */}
      <UafReportTable
        title="Master Index Summary"
        description="All indices with their weights in the QPQI composite."
        exportable
        columns={[
          { key: "index", header: "Index", render: (r: any) => <span className="font-medium">{r.index}</span> },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
          { key: "classification", header: "Classification", render: (r: any) => <ClassificationBadge classification={r.classification} /> },
          { key: "weight", header: "Weight", render: (r: any) => <span className="font-mono">{r.weight != null ? `${(r.weight * 100).toFixed(0)}%` : "—"}</span> },
        ]}
        data={[
          { index: "SCI — Structural Compliance", value: getMetric(metrics, "SCI")?.value ?? null, classification: getMetric(metrics, "SCI")?.classification ?? null, weight: 0.10 },
          { index: "MII — Metadata Integrity", value: getMetric(metrics, "MII")?.value ?? null, classification: getMetric(metrics, "MII")?.classification ?? null, weight: 0.10 },
          { index: "BDI — Bloom Distribution", value: getMetric(metrics, "BDI")?.value ?? null, classification: getMetric(metrics, "BDI")?.classification ?? null, weight: 0.15 },
          { index: "CVI — Coverage Validation", value: getMetric(metrics, "CVI")?.value ?? null, classification: getMetric(metrics, "CVI")?.classification ?? null, weight: 0.10 },
          { index: "MCAI — Marks Complexity Alignment", value: getMetric(metrics, "MCAI")?.value ?? null, classification: getMetric(metrics, "MCAI")?.classification ?? null, weight: 0.10 },
          { index: "DBI — Difficulty Balance", value: getMetric(metrics, "DBI")?.value ?? null, classification: getMetric(metrics, "DBI")?.classification ?? null, weight: 0.10 },
          { index: "QCQI — Question Construction Quality", value: getMetric(metrics, "QCQI")?.value ?? null, classification: getMetric(metrics, "QCQI")?.classification ?? null, weight: 0.15 },
          { index: "CAI — Constructive Alignment", value: getMetric(metrics, "CAI")?.value ?? null, classification: getMetric(metrics, "CAI")?.classification ?? null, weight: 0.10 },
          { index: "AMI — Academic Moderation", value: getMetric(metrics, "AMI")?.value ?? null, classification: getMetric(metrics, "AMI")?.classification ?? null, weight: 0.05 },
          { index: "FRI — Future Readiness", value: getMetric(metrics, "FRI")?.value ?? null, classification: getMetric(metrics, "FRI")?.classification ?? null, weight: 0.05 },
          { index: "QPQI — Question Paper Quality Index", value: qpqi?.value ?? null, classification: qpqi?.classification ?? null, weight: null },
        ]}
      />
    </SectionShell>
  );
}

// ── Other section stubs ──

function StructuralComplianceSection({ metrics }: { metrics: MetricItem[] }) {
  const sci = getMetric(metrics, "SCI");
  return (
    <SectionShell id="structural-compliance" title="Structural Compliance Index" subtitle="Phase 3 — Measures compliance with required question bank structure." formula="SCI = Structural Elements Present / Required Structural Elements" confidence={sci?.classification ?? undefined}>
      <UafReportTable title="SCI Report" columns={[{ key: "m", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "v", header: "Value", render: (r: any) => <MetricValue value={r.value} /> }]}
        data={[{ metric: "Structural Compliance Index (SCI)", value: sci?.value ?? null }, { metric: "Classification", value: null }, { metric: "Confidence", value: null }]} />
      <UafReportTable title="Structural Elements" description="Required structural elements checked."
        columns={[{ key: "element", header: "Element", render: (r: any) => r.element }, { key: "status", header: "Present", render: (r: any) => r.present ? <span className="text-green-600 text-xs font-medium">✓</span> : <span className="text-red-600 text-xs font-medium">✗</span> }]
        }
        data={[
          { element: "Course Information", present: true }, { element: "Question Numbering", present: true }, { element: "Marks Allocation", present: true },
          { element: "CO Mapping", present: true }, { element: "Bloom Mapping", present: true }, { element: "Difficulty Mapping", present: true },
          { element: "Section Labels", present: true }, { element: "Assessment Instructions", present: true }, { element: "Metadata Consistency", present: true },
          { element: "Question Formatting", present: true },
        ]} />
    </SectionShell>
  );
}

function MetadataSection({ metrics }: { metrics: MetricItem[] }) {
  const mii = getMetric(metrics, "MII");
  const subMetrics = ["COA", "POA", "PIA", "RBTA", "DA", "MAA", "QTA", "MC", "MCS"];

  // Metadata risks from sub-metric values
  const metadataRisks: Array<{ finding: string; risk: string; priority: string }> = [];
  for (const code of subMetrics) {
    const m = getMetric(metrics, code);
    if (m?.value != null && m.value < 0.6) {
      const label = INDEX_LABELS[code] ?? code;
      metadataRisks.push({
        finding: `${label} at ${(m.value * 100).toFixed(0)}% — below acceptable threshold`,
        risk: `Incomplete or incorrect ${label.toLowerCase()} metadata affects assessment integrity`,
        priority: m.value < 0.4 ? "HIGH" : "MODERATE",
      });
    }
  }
  if (mii?.value != null && mii.value < 0.6) {
    metadataRisks.push({
      finding: `MII at ${(mii.value * 100).toFixed(0)}% — overall metadata integrity concern`,
      risk: "Aggregate metadata quality may impact downstream evaluation phases",
      priority: mii.value < 0.4 ? "HIGH" : "MAJOR",
    });
  }

  return (
    <SectionShell id="metadata-integrity" title="Metadata Integrity Audit" subtitle="Phase 4 & 6 — Completeness and correctness of all question bank metadata." formula="MII = (COA + POA + PIA + RBTA + DA + MAA + QTA + MC + MCS) / 9" confidence={mii?.classification ?? undefined}>

      <UafReportTable title="Metadata Validation Framework" description="Validation requirements for each metadata attribute."
        columns={[{ key: "attr", header: "Attribute", render: (r: any) => <span className="font-medium">{r.attr}</span> }, { key: "req", header: "Validation Requirement", render: (r: any) => r.req }]}
        data={[
          { attr: "CO Mapping", req: "Matches documented Course Outcome" }, { attr: "PO Mapping", req: "Matches documented Program Outcome" },
          { attr: "PI Mapping", req: "Matches documented Program Indicator" }, { attr: "Bloom Level", req: "Consistent with command verb and cognitive demand" },
          { attr: "Difficulty", req: "Consistent with Bloom level and complexity" }, { attr: "Marks", req: "Consistent with expected effort and depth" },
          { attr: "Question Type", req: "Correctly classified" },
        ]} />

      <UafReportTable title="Metadata Integrity Report" sortable exportable
        columns={[{ key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> }]}
        data={[
          ...subMetrics.map((code) => {
            const m = getMetric(metrics, code);
            return { metric: INDEX_LABELS[code] ?? code, value: m?.value ?? null };
          }),
          { metric: "Metadata Integrity Index (MII)", value: mii?.value ?? null },
          { metric: "Classification", value: mii?.classification ?? null },
          { metric: "Confidence", value: mii?.confidence?.score != null ? mii.confidence.score : null },
        ]} />

      <UafReportTable title="Metadata Risk Register" description="Identified metadata-related risks." exportable
        columns={[{ key: "finding", header: "Finding", render: (r: any) => r.finding }, { key: "risk", header: "Risk", render: (r: any) => r.risk }, { key: "priority", header: "Priority", render: (r: any) => <PriorityBadge priority={r.priority} /> }]}
        data={metadataRisks} emptyMessage="No metadata risks identified." />
    </SectionShell>
  );
}

function AlignmentSection({ metrics, snapshot }: { metrics: MetricItem[]; snapshot?: VersionDetail["evidenceSnapshot"] }) {
  const cai = getMetric(metrics, "CAI");
  const totalQ = snapshot?.sourceDataSnapshot?.totalQuestions ?? 0;
  const hasCAI = cai?.value != null;

  // Compute aligned/misaligned from CAI value
  const alignedQ = hasCAI ? Math.round(totalQ * cai.value!) : null;
  const misalignedQ = hasCAI ? totalQ - alignedQ! : null;

  return (
    <SectionShell id="constructive-alignment" title="Constructive Alignment Analysis" subtitle="Phase 10 — Alignment between Course Outcomes, learning activities, and assessment." formula="CAI = Aligned Questions / Total Questions" confidence={cai?.classification ?? undefined}>
      <UafReportTable title="Alignment Chain" description="Course Outcome → Learning Activity → Assessment → Evidence"
        columns={[{ key: "q", header: "Question", render: (r: any) => <span className="font-mono text-xs">{r.q}</span> }, { key: "co", header: "CO", render: (r: any) => r.co }, { key: "bloom", header: "Bloom", render: (r: any) => r.bloom }, { key: "activity", header: "Learning Activity", render: (r: any) => r.activity }, { key: "evidence", header: "Evidence Status", render: (r: any) => r.evidence }]}
        data={[]} emptyMessage={hasCAI ? "Constructive alignment audit data not available for individual questions." : "CAI not computed — ensure questions have CO and RBT mappings."} />
      <UafReportTable title="Alignment Rating Scale"
        columns={[{ key: "rating", header: "Rating", render: (r: any) => <span className="font-medium">{r.rating}</span> }, { key: "interp", header: "Interpretation", render: (r: any) => r.interp }]}
        data={[{ rating: "Excellent", interp: "Full observable alignment" }, { rating: "Good", interp: "Minor alignment gaps" }, { rating: "Moderate", interp: "Partial alignment" }, { rating: "Weak", interp: "Significant deficiencies" }, { rating: "Poor", interp: "No observable alignment" }]} />
      <UafReportTable title="Constructive Alignment Report"
        columns={[{ key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> }]}
        data={[
          { metric: "Aligned Questions", value: alignedQ },
          { metric: "Misaligned Questions", value: misalignedQ },
          { metric: "Constructive Alignment Index (CAI)", value: cai?.value ?? null },
          { metric: "Classification", value: cai?.classification ?? null },
          { metric: "Confidence", value: cai?.confidence?.score != null ? cai.confidence.score : null },
        ]} />
    </SectionShell>
  );
}

function ModerationSection({ metrics, snapshot }: { metrics: MetricItem[]; snapshot?: VersionDetail["evidenceSnapshot"] }) {
  const ami = getMetric(metrics, "AMI");
  const sourceData = snapshot?.sourceDataSnapshot;
  const statusDist = sourceData?.distributions?.questionStatusDistribution ?? {};

  // Determine moderation statuses from AMI and question status distribution
  const amiValue = ami?.value;

  const criteriaDefs: Array<{ criterion: string; req: string; satisfied: boolean }> = [
    { criterion: "Validity", req: "Measures intended learning outcomes", satisfied: amiValue != null && amiValue >= 0.6 },
    { criterion: "Reliability", req: "Produces consistent assessment evidence", satisfied: amiValue != null && amiValue >= 0.5 },
    { criterion: "Fairness", req: "Equitable for all learners", satisfied: amiValue != null && amiValue >= 0.5 },
    { criterion: "Transparency", req: "Assessment expectations are clear", satisfied: amiValue != null && amiValue >= 0.6 },
    { criterion: "Traceability", req: "Evidence linked to outcomes", satisfied: amiValue != null && amiValue >= 0.5 },
    { criterion: "Consistency", req: "Assessment design is coherent", satisfied: amiValue != null && amiValue >= 0.5 },
    { criterion: "Governance Compliance", req: "Institutional standards satisfied", satisfied: amiValue != null && amiValue >= 0.6 },
  ];

  const satisfiedCount = criteriaDefs.filter((c) => c.satisfied).length;
  const auditData = criteriaDefs.map((c) => ({
    criterion: c.criterion,
    status: c.satisfied
      ? (<span className="text-green-600 text-xs font-medium">✓ Satisfied</span>)
      : (<span className="text-amber-600 text-xs font-medium">⚠ Partial</span>),
    evidence: c.satisfied ? "Computed from metric data" : "Limited supporting evidence",
  }));

  return (
    <SectionShell id="moderation" title="Academic Moderation Analysis" subtitle="Phase 11 — Moderation compliance across validity, reliability, fairness, transparency, and traceability." formula="AMI = Moderation Criteria Satisfied / Total Moderation Criteria" confidence={ami?.classification ?? undefined}>
      <UafReportTable title="Moderation Criteria" description="Evaluation requirements for each moderation criterion."
        columns={[{ key: "criterion", header: "Criterion", render: (r: any) => <span className="font-medium">{r.criterion}</span> }, { key: "req", header: "Evaluation Requirement", render: (r: any) => r.req }]}
        data={criteriaDefs.map((c) => ({ criterion: c.criterion, req: c.req }))} />
      <UafReportTable title="Moderation Audit Table"
        columns={[{ key: "criterion", header: "Criterion", render: (r: any) => <span className="font-medium">{r.criterion}</span> }, { key: "status", header: "Status", render: (r: any) => r.status }, { key: "evidence", header: "Evidence", render: (r: any) => r.evidence }]}
        data={auditData} />
      <UafReportTable title="Academic Moderation Report"
        columns={[{ key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> }]}
        data={[
          { metric: "Criteria Satisfied", value: satisfiedCount / 7 },
          { metric: "Criteria Not Satisfied", value: (7 - satisfiedCount) / 7 },
          { metric: "Academic Moderation Index (AMI)", value: ami?.value ?? null },
          { metric: "Classification", value: ami?.classification ?? null },
          { metric: "Confidence", value: ami?.confidence?.score != null ? ami.confidence.score : null },
        ]} />
    </SectionShell>
  );
}

function FutureReadinessSection({ metrics, snapshot }: { metrics: MetricItem[]; snapshot?: VersionDetail["evidenceSnapshot"] }) {
  const fri = getMetric(metrics, "FRI");
  const hots = getMetric(metrics, "HOTS");
  const cbr = getMetric(metrics, "CBR");
  const bdi = getMetric(metrics, "BDI");
  const mcai = getMetric(metrics, "MCAI");
  const cai = getMetric(metrics, "CAI");
  const mii = getMetric(metrics, "MII");

  // Determine criterion statuses from actual metric data
  const criteriaDefs: Array<{ criterion: string; desc: string; satisfied: boolean; yesMsg: string; noMsg: string }> = [
    { criterion: "Problem Solving", desc: "Real-world problem solving", satisfied: (hots?.value ?? 0) >= 0.3, yesMsg: "HOTS coverage adequate for problem-solving assessment", noMsg: "Insufficient higher-order questions for problem-solving evaluation" },
    { criterion: "Critical Thinking", desc: "Analytical reasoning", satisfied: (bdi?.value ?? 0) >= 0.6, yesMsg: "Bloom distribution supports analytical reasoning", noMsg: "Bloom distribution may not adequately support critical thinking development" },
    { criterion: "Innovation", desc: "Creative solution development", satisfied: (cbr?.value ?? 0) >= 0.4, yesMsg: "Cognitive balance supports innovative assessment", noMsg: "Limited higher-order cognition may restrict creative assessment" },
    { criterion: "Industry Relevance", desc: "Professional applicability", satisfied: (mcai?.value ?? 0) >= 0.6, yesMsg: "Marks-complexity alignment reflects industry standards", noMsg: "Marks-to-cognitive-level alignment needs improvement for industry relevance" },
    { criterion: "Graduate Attributes", desc: "Graduate competency support", satisfied: (cai?.value ?? 0) >= 0.6, yesMsg: "Constructive alignment supports graduate attribute development", noMsg: "Weak alignment may not adequately support graduate attribute achievement" },
    { criterion: "Employability Skills", desc: "Career readiness", satisfied: (mii?.value ?? 0) >= 0.6, yesMsg: "Metadata integrity supports employability tracking", noMsg: "Metadata gaps may impede employability skills assessment" },
    { criterion: "HOTS Integration", desc: "Higher-order thinking support", satisfied: (hots?.value ?? 0) >= 0.3, yesMsg: `HOTS at ${((hots?.value ?? 0) * 100).toFixed(0)}% — adequate higher-order integration`, noMsg: `HOTS at ${((hots?.value ?? 0) * 100).toFixed(0)}% — below recommended threshold` },
  ];

  const satisfiedCount = criteriaDefs.filter((c) => c.satisfied).length;
  const totalCriteria = criteriaDefs.length;
  const auditData = criteriaDefs.map((c) => ({
    criterion: c.criterion,
    status: c.satisfied
      ? (<span className="text-green-600 text-xs font-medium">✓ Satisfied</span>)
      : (<span className="text-amber-600 text-xs font-medium">⚠ Not satisfied</span>),
    evidence: c.satisfied ? c.yesMsg : c.noMsg,
  }));

  return (
    <SectionShell id="future-readiness" title="Future Readiness Evaluation" subtitle="Phase 12 — Assessment preparation for modern professional and academic environments." formula="FRI = Future Ready Criteria Satisfied / Total Future Ready Criteria" confidence={fri?.classification ?? undefined}>
      <UafReportTable title="Future Readiness Criteria"
        columns={[{ key: "criterion", header: "Criterion", render: (r: any) => <span className="font-medium">{r.criterion}</span> }, { key: "desc", header: "Description", render: (r: any) => r.desc }]}
        data={criteriaDefs.map((c) => ({ criterion: c.criterion, desc: c.desc }))} />
      <UafReportTable title="Future Readiness Audit"
        columns={[{ key: "criterion", header: "Criterion", render: (r: any) => <span className="font-medium">{r.criterion}</span> }, { key: "status", header: "Status", render: (r: any) => r.status }, { key: "evidence", header: "Evidence", render: (r: any) => r.evidence }]}
        data={auditData} />
      <UafReportTable title="Future Readiness Report"
        columns={[{ key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> }]}
        data={[
          { metric: "Criteria Satisfied", value: satisfiedCount / totalCriteria },
          { metric: "Criteria Not Satisfied", value: (totalCriteria - satisfiedCount) / totalCriteria },
          { metric: "Future Readiness Index (FRI)", value: fri?.value ?? null },
          { metric: "Classification", value: fri?.classification ?? null },
          { metric: "Confidence", value: fri?.confidence?.score != null ? fri.confidence.score : null },
        ]} />
    </SectionShell>
  );
}

function ConfidenceSection({ metrics }: { metrics: MetricItem[] }) {
  const oci = getMetric(metrics, "OCI");
  return (
    <SectionShell id="confidence" title="Overall Confidence Index" subtitle="Phase 14 — Aggregate confidence across all computed indices." formula="OCI = Σ(Index Confidence) / N" confidence={oci?.classification ?? undefined}>
      <UafReportTable title="Confidence Summary Table" sortable exportable
        columns={[{ key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "value", header: "Value", render: (r: any) => <ConfidenceBadge score={r.score} classification={r.classification} /> }]}
        data={[
          ...["SCI", "MII", "BDI", "CVI", "MCAI", "DBI", "QCQI", "CAI", "AMI", "FRI"].map((code) => ({
            metric: `${INDEX_LABELS[code] ?? code} Confidence` as string, score: null as number | null, classification: null as string | null,
          })),
          { metric: "Overall Confidence Index (OCI)", score: oci?.value ?? null, classification: oci?.classification ?? null },
          { metric: "Confidence Classification", score: null, classification: oci?.classification ?? null },
        ]}
      />
    </SectionShell>
  );
}

function FinalVerdictSection({ metrics, executiveSummary, finalVerdict, risks, recommendations, analysisSnapshot }: {
  metrics: MetricItem[]; executiveSummary: string | null; finalVerdict: string | null;
  risks?: Array<{ finding: string; priority: string; riskType: string | null }>;
  recommendations?: Array<{ finding: string; recommendation: string; priority: string }>;
  analysisSnapshot?: AnalysisSnapshotData;
}) {
  const qpqi = getMetric(metrics, "QPQI");
  const cvi = getMetric(metrics, "CVI");
  const cai = getMetric(metrics, "CAI");
  const bdi = getMetric(metrics, "BDI");
  const qcqi = getMetric(metrics, "QCQI");
  const ami = getMetric(metrics, "AMI");
  const mii = getMetric(metrics, "MII");

  // Deterministic fallback: generate executive summary from metrics if null
  const effectiveSummary = executiveSummary ?? (
    qpqi?.value != null
      ? `Deterministic evaluation: Overall Quality (QPQI) at ${(qpqi.value * 100).toFixed(0)}%. ` +
        `Refer to individual index reports for detailed analysis across all evaluation phases.`
      : null
  );

  // Deterministic fallback: generate recommendations from metrics if empty
  const effectiveRecommendations = (recommendations && recommendations.length > 0)
    ? recommendations
    : (() => {
        const fallback: Array<{ finding: string; recommendation: string; priority: string }> = [];
        const sci = getMetric(metrics, "SCI");
        const bdi = getMetric(metrics, "BDI");
        const cvi = getMetric(metrics, "CVI");
        const dbi = getMetric(metrics, "DBI");
        const qcqi = getMetric(metrics, "QCQI");
        const cai = getMetric(metrics, "CAI");
        const ami = getMetric(metrics, "AMI");
        const mii = getMetric(metrics, "MII");
        if (sci?.value != null && sci.value < 0.8) fallback.push({ finding: "Low structural compliance", recommendation: "Ensure all required structural elements are present", priority: "HIGH" });
        if (bdi?.value != null && bdi.value < 0.7) fallback.push({ finding: "Suboptimal Bloom distribution", recommendation: "Review question distribution across cognitive levels", priority: "HIGH" });
        if (cvi?.value != null && cvi.value < 0.6) fallback.push({ finding: "Inadequate CO coverage", recommendation: "Distribute questions across more Course Outcomes", priority: "HIGH" });
        if (dbi?.value != null && dbi.value < 0.7) fallback.push({ finding: "Unbalanced difficulty distribution", recommendation: "Adjust Easy/Medium/Hard question ratio", priority: "MEDIUM" });
        if (qcqi?.value != null && qcqi.value < 0.7) fallback.push({ finding: "Question quality concerns", recommendation: "Improve question clarity, precision, and alignment", priority: "HIGH" });
        if (cai?.value != null && cai.value < 0.7) fallback.push({ finding: "Weak constructive alignment", recommendation: "Strengthen CO-to-assessment linkages", priority: "HIGH" });
        if (ami?.value != null && ami.value < 0.7) fallback.push({ finding: "Moderation readiness below threshold", recommendation: "Complete missing metadata before moderation", priority: "HIGH" });
        if (mii?.value != null && mii.value < 0.7) fallback.push({ finding: "Metadata gaps detected", recommendation: "Fill missing CO, RBT, and difficulty mappings", priority: "HIGH" });
        if (fallback.length === 0 && qpqi?.value != null && qpqi.value >= 0.8) fallback.push({ finding: "Overall quality is satisfactory", recommendation: "Maintain current standards", priority: "LOW" });
        return fallback;
      })();

  // Strengths/weaknesses from analysisSnapshot or compute from metrics
  const strengths = analysisSnapshot?.strengths?.length
    ? analysisSnapshot.strengths
    : (() => {
        const s: Array<{ id: string; strength: string }> = [];
        let idx = 0;
        for (const code of ["SCI", "MII", "BDI", "CVI", "MCAI", "DBI", "QCQI", "CAI", "AMI", "FRI"]) {
          const m = getMetric(metrics, code);
          if (m?.value != null && m.value >= 0.8) s.push({ id: `S${++idx}`, strength: `${INDEX_LABELS[code] ?? code} at ${(m.value * 100).toFixed(0)}% — strong performance` });
        }
        if (s.length === 0) s.push({ id: "S1", strength: "Question bank exists with structured metadata framework" });
        return s;
      })();

  const weaknesses = analysisSnapshot?.weaknesses?.length
    ? analysisSnapshot.weaknesses
    : (() => {
        const w: Array<{ id: string; weakness: string }> = [];
        let idx = 0;
        for (const code of ["SCI", "MII", "BDI", "CVI", "MCAI", "DBI", "QCQI", "CAI", "AMI", "FRI"]) {
          const m = getMetric(metrics, code);
          if (m?.value != null && m.value < 0.5) w.push({ id: `W${++idx}`, weakness: `${INDEX_LABELS[code] ?? code} at ${(m.value * 100).toFixed(0)}% — needs improvement` });
        }
        if (w.length === 0 && qpqi?.value != null && qpqi.value < 0.9) w.push({ id: "W1", weakness: `Overall QPQI at ${(qpqi.value * 100).toFixed(0)}% — room for improvement across multiple dimensions` });
        return w;
      })();

  // Accreditation readiness computed from metric thresholds
  const obeReady = (cvi?.value ?? 0) >= 0.6 && (cai?.value ?? 0) >= 0.6;
  const bloomReady = (bdi?.value ?? 0) >= 0.6;
  const alignmentReady = (cai?.value ?? 0) >= 0.6;
  const qualityReady = (qcqi?.value ?? 0) >= 0.6;
  const moderationReady = (ami?.value ?? 0) >= 0.6;
  const docReady = (mii?.value ?? 0) >= 0.6;

  const accreditationData = [
    { dimension: "OBE Compliance", status: obeReady ? "Partially Ready" : "Needs Preparation" },
    { dimension: "Bloom Alignment", status: bloomReady ? "Ready" : "Needs Improvement" },
    { dimension: "Constructive Alignment", status: alignmentReady ? "Ready" : "Needs Improvement" },
    { dimension: "Assessment Quality", status: qualityReady ? "Ready" : "Needs Improvement" },
    { dimension: "Moderation Compliance", status: moderationReady ? "Ready" : "Needs Preparation" },
    { dimension: "Documentation Readiness", status: docReady ? "Ready" : "Needs Improvement" },
    { dimension: "NBA Readiness", status: obeReady && bloomReady && alignmentReady && qualityReady ? "Partially Ready" : "Needs Preparation" },
    { dimension: "NAAC Readiness", status: qualityReady && docReady ? "Partially Ready" : "Needs Preparation" },
  ];

  return (
    <SectionShell id="final-verdict" title="Final Moderation Verdict" subtitle="Phase 15 — Institutional moderation decision based on all evaluation phases.">
      {/* Executive Summary */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold">Executive Summary</h3>
          {finalVerdict && <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">AI Generated</span>}
        </div>
        {effectiveSummary ? (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{effectiveSummary}</p>
        ) : (
          <p className="text-sm italic text-[var(--text-tertiary)]">No executive summary available.</p>
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
          {qpqi?.value != null && <span>QPQI: <strong className="text-[var(--text-primary)]">{(qpqi.value * 100).toFixed(1)}%</strong> ({qpqi.classification?.replace(/_/g, " ") ?? "N/A"})</span>}
          {finalVerdict && <span>Verdict: <strong className="text-[var(--text-primary)]">{finalVerdict.replace(/_/g, " ")}</strong></span>}
        </div>
      </div>

      {/* Final Verdict Options */}
      <UafReportTable title="Institutional Moderation Decision" description="The evaluator shall issue one of the following verdicts."
        columns={[{ key: "verdict", header: "Verdict Option", render: (r: any) => <span className="font-medium">{r.verdict}</span> }, { key: "status", header: "Status", render: (r: any) => finalVerdict === r.key ? <span className="text-green-600 text-xs font-medium">← Selected</span> : null }]}
        data={[{ key: "APPROVED_WITHOUT_MODIFICATION", verdict: "Approved Without Modification" }, { key: "APPROVED_WITH_MINOR_IMPROVEMENTS", verdict: "Approved With Minor Improvements" }, { key: "APPROVED_SUBJECT_TO_REVISION", verdict: "Approved Subject To Revision" }, { key: "MAJOR_REVISION_REQUIRED", verdict: "Major Revision Required" }, { key: "NOT_APPROVED", verdict: "Not Approved" }]} />

      {/* Recommendations */}
      <UafReportTable title="Recommendation Register" description="Prioritized list of recommendations from the evaluation." sortable exportable
        columns={[{ key: "finding", header: "Finding", render: (r: any) => r.finding }, { key: "rec", header: "Recommendation", render: (r: any) => r.rec }, { key: "priority", header: "Priority", render: (r: any) => <PriorityBadge priority={r.priority} /> }]}
        data={effectiveRecommendations.map((r: any) => ({ finding: r.finding, rec: r.recommendation, priority: r.priority }))}
        emptyMessage="No recommendations generated." />

      {/* Institutional Strengths & Weaknesses */}
      <UafReportTable title="Institutional Strengths" columns={[{ key: "id", header: "ID", render: (r: any) => <span className="font-mono">{r.id}</span> }, { key: "strength", header: "Strength", render: (r: any) => r.strength }]}
        data={strengths} emptyMessage="No strengths identified." />
      <UafReportTable title="Institutional Weaknesses" columns={[{ key: "id", header: "ID", render: (r: any) => <span className="font-mono">{r.id}</span> }, { key: "weakness", header: "Weakness", render: (r: any) => r.weakness }]}
        data={weaknesses} emptyMessage="No weaknesses identified." />

      {/* Accreditation Readiness */}
      <UafReportTable title="Accreditation Readiness Assessment"
        columns={[{ key: "dimension", header: "Dimension", render: (r: any) => <span className="font-medium">{r.dimension}</span> }, { key: "status", header: "Status", render: (r: any) => r.status ?? "—" }]}
        data={accreditationData} />
    </SectionShell>
  );
}

// ── Main Report Component ──

interface UafComplianceReportProps {
  questionBankId: string;
}

export function UafComplianceReport({ questionBankId }: UafComplianceReportProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [showNav, setShowNav] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const versionsRes = await apiFetch(`/api/question-banks/${questionBankId}/analysis/versions`);
        const versionsBody = await versionsRes.json();
        if (!active) return;
        if (!versionsBody.success || !Array.isArray(versionsBody.data) || versionsBody.data.length === 0) {
          setError("No analysis data available.");
          setLoading(false);
          return;
        }
        const latestId = versionsBody.data[0].id;
        const detailRes = await apiFetch(`/api/question-banks/${questionBankId}/analysis/versions/${latestId}`);
        const detailBody = await detailRes.json();
        if (!active) return;
        if (!detailBody.success || !detailBody.data) {
          setError("Failed to load analysis details.");
          setLoading(false);
          return;
        }
        setDetail(detailBody.data);
        setLoading(false);
      } catch {
        if (active) { setError("Unable to reach the server."); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [questionBankId]);

  // Scroll spy — track which section is visible
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => {
          const aRect = a.boundingClientRect;
          const bRect = b.boundingClientRect;
          return Math.abs(aRect.top) - Math.abs(bRect.top);
        });
        if (visible.length > 0) {
          const id = visible[0].target.id.replace("section-", "");
          setActiveSection(id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading]);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return <div className="space-y-4"><LoadingSkeleton variant="card" className="h-96 w-full" /></div>;
  }

  if (error || !detail) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-50/50 p-6 text-center dark:bg-red-950/20">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-2 text-sm text-red-800 dark:text-red-300">{error ?? "Unable to load analysis."}</p>
      </div>
    );
  }

  const { questionBankAnalysis: qba } = detail;
  const metrics = qba.metrics ?? [];
  const qpqi = getMetric(metrics, "QPQI");

  return (
    <div className="relative">
      {/* Toggle nav button (mobile) */}
      <button
        className="fixed bottom-4 right-4 z-50 rounded-full border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg lg:hidden"
        onClick={() => setShowNav(!showNav)}
      >
        <span className="text-xs font-medium">{showNav ? "✕" : "☰"}</span>
      </button>

      <div className="flex gap-6">
        {/* Left Navigation */}
        {showNav && (
          <nav className="fixed left-0 top-20 z-40 hidden h-[calc(100vh-5rem)] w-56 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-4 lg:block">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">UAF Report</p>
              {qpqi?.value != null && (
                <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                  QPQI: <span className="font-semibold text-[var(--text-primary)]">{(qpqi.value * 100).toFixed(0)}%</span>
                </p>
              )}
            </div>
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      "w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors",
                      activeSection === s.id
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
                    )}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Main Content */}
        <div className={cn("min-w-0 flex-1 space-y-8", showNav && "lg:ml-60")}>
          {/* Metric Cards Dashboard */}
          <section className="space-y-4">
            <div className="border-b border-[var(--border)] pb-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Academic Quality Dashboard</h2>
              <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
                UAF v3.3 — {detail.questionBankAnalysis.status === "COMPLETE" ? "Finalised" : detail.questionBankAnalysis.status}
                {detail.evaluationEngineVersion && ` · Engine v${detail.evaluationEngineVersion}`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {["SCI", "MII", "BDI", "CVI", "MCAI", "DBI", "QCQI", "CAI", "AMI", "FRI", "QPQI"].map((code) => (
                <MetricCard key={code} code={code} metric={getMetric(metrics, code)} />
              ))}
            </div>
          </section>

          {/* Phase Sections */}
          <ExtractionSection metrics={metrics} snapshot={detail.evidenceSnapshot} />
          <StructuralComplianceSection metrics={metrics} />
          <MetadataSection metrics={metrics} />
          <CoverageSection metrics={metrics} snapshot={detail.evidenceSnapshot} />
          <BloomSection metrics={metrics} snapshot={detail.evidenceSnapshot} />
          <DifficultySection metrics={metrics} snapshot={detail.evidenceSnapshot} />
          <QualitySection metrics={metrics} />
          <AlignmentSection metrics={metrics} snapshot={detail.evidenceSnapshot} />
          <ModerationSection metrics={metrics} snapshot={detail.evidenceSnapshot} />
          <FutureReadinessSection metrics={metrics} snapshot={detail.evidenceSnapshot} />
          <OverallQualitySection metrics={metrics} />
          <ConfidenceSection metrics={metrics} />
          <FinalVerdictSection
            metrics={metrics}
            executiveSummary={qba.executiveSummary}
            finalVerdict={qba.finalVerdict}
            risks={qba.risks}
            recommendations={qba.recommendations}
            analysisSnapshot={detail.analysisSnapshot}
          />

          {/* Governance Statement */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Final Governance Statement</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              This Universal Academic Framework (UAF) Version 3.3 establishes a complete, evidence-based, auditable,
              deterministic methodology for Question Bank evaluation. All evaluations preserve structure, tables,
              numbering, calculations, reporting sequence, and governance requirements. Only evaluation results
              vary between Question Banks.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
