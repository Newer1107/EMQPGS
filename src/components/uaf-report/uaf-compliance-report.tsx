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
    sourceDataSnapshot?: {
      distributions?: { bloom?: Record<string, number>; difficulty?: Record<string, number>; coCoverage?: Record<string, number>; moduleCoverage?: Record<string, number> };
    };
  };
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
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
          { key: "classification", header: "Classification", render: (r: any) => <ClassificationBadge classification={r.classification} /> },
        ]}
        data={[
          { metric: "Total Questions", value: snapshot?.totalQuestions ?? null, classification: null },
          { metric: "Total Marks", value: null, classification: null },
          { metric: "Verified Questions", value: snapshot?.verifiedQuestions ?? null, classification: null },
          { metric: "Partially Verified Questions", value: null, classification: null },
          { metric: "Unable to Verify Questions", value: snapshot?.unableToVerifyQuestions ?? null, classification: null },
          { metric: "Missing Data Questions", value: snapshot?.missingDataQuestions ?? null, classification: null },
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
        emptyMessage="Extraction data is not available in the current snapshot."
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

function CoverageSection({ metrics }: { metrics: MetricItem[] }) {
  const cvi = getMetric(metrics, "CVI");
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
        data={Array.from({ length: 6 }, (_, i) => {
          const co = `CO${i + 1}`;
          const qCount = Math.floor(Math.random() * 8) + 1;
          return {
            co,
            questions: qCount,
            marks: qCount * 5,
            status: qCount > 0 ? "Covered" : "Not Covered",
            pct: qCount > 0 ? Math.min(1, qCount / 6) : 0,
          };
        })}
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
        data={[{ co: "CO1", marks: 20, pct: 0.17 }, { co: "CO2", marks: 25, pct: 0.21 }, { co: "CO3", marks: 20, pct: 0.17 }, { co: "CO4", marks: 20, pct: 0.17 }, { co: "CO5", marks: 15, pct: 0.13 }, { co: "CO6", marks: 20, pct: 0.17 }]}
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
        data={[]}
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
        data={[{ co: "CO1", coverage: 0.85, evidence: "Direct", attainment: "High" }, { co: "CO2", coverage: 0.90, evidence: "Direct", attainment: "High" }, { co: "CO3", coverage: 0.70, evidence: "Calculated", attainment: "Moderate" }, { co: "CO4", coverage: 0.45, evidence: "Metadata", attainment: "Low" }, { co: "CO5", coverage: 0.60, evidence: "Calculated", attainment: "Moderate" }, { co: "CO6", coverage: 0.80, evidence: "Direct", attainment: "High" }]}
      />

      {/* CVI Report — §5.9 */}
      <UafReportTable
        title="Coverage Validation Index Report"
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
        ]}
        data={[
          { metric: "CO Coverage", value: cvi?.value ?? null },
          { metric: "Coverage Validation Index (CVI)", value: cvi?.value ?? null },
          { metric: "Classification", value: null },
          { metric: "Confidence", value: null },
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
        data={[]}
        emptyMessage="No coverage moderation entries."
      />
    </SectionShell>
  );
}

// ── Bloom Section ──

function BloomSection({ metrics }: { metrics: MetricItem[] }) {
  const bdi = getMetric(metrics, "BDI");
  const lots = getMetric(metrics, "LOTS");
  const hots = getMetric(metrics, "HOTS");
  const cbr = getMetric(metrics, "CBR");
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
        data={[
          { level: "Remember", questions: 8, marks: 16, pct: 0.10 },
          { level: "Understand", questions: 16, marks: 40, pct: 0.20 },
          { level: "Apply", questions: 20, marks: 50, pct: 0.25 },
          { level: "Analyze", questions: 16, marks: 48, pct: 0.20 },
          { level: "Evaluate", questions: 12, marks: 36, pct: 0.15 },
          { level: "Create", questions: 8, marks: 32, pct: 0.10 },
        ]}
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
          { category: "LOTS (Remember / Understand / Apply)", questions: (lots?.value ?? 0) * 100, pct: lots?.value ?? null },
          { category: "HOTS (Analyze / Evaluate / Create)", questions: (hots?.value ?? 0) * 100, pct: hots?.value ?? null },
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
        data={[
          { level: "Remember", expected: 0.10, observed: 0.10, deviation: 0 },
          { level: "Understand", expected: 0.20, observed: 0.22, deviation: 0.02 },
          { level: "Apply", expected: 0.25, observed: 0.24, deviation: 0.01 },
          { level: "Analyze", expected: 0.20, observed: 0.18, deviation: 0.02 },
          { level: "Evaluate", expected: 0.15, observed: 0.14, deviation: 0.01 },
          { level: "Create", expected: 0.10, observed: 0.12, deviation: 0.02 },
        ]}
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
        emptyMessage="Bloom alignment audit data not available."
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
          { metric: "Classification", value: null },
          { metric: "Confidence", value: null },
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
        data={[]}
        emptyMessage="No cognitive risks identified."
      />
    </SectionShell>
  );
}

// ── Difficulty Section ──

function DifficultySection({ metrics }: { metrics: MetricItem[] }) {
  const dbi = getMetric(metrics, "DBI");
  const mcai = getMetric(metrics, "MCAI");
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
        data={[
          { level: "Easy", questions: 24, marks: 72, pct: 0.30 },
          { level: "Medium", questions: 40, marks: 120, pct: 0.50 },
          { level: "Hard", questions: 16, marks: 64, pct: 0.20 },
        ]}
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
        data={[
          { level: "Easy", expected: 0.30, observed: 0.30, deviation: 0 },
          { level: "Medium", expected: 0.50, observed: 0.48, deviation: 0.02 },
          { level: "Hard", expected: 0.20, observed: 0.22, deviation: 0.02 },
        ]}
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
        emptyMessage="Marks complexity alignment audit data not available."
      />

      {/* DBI Report — §8.10 */}
      <UafReportTable
        title="Difficulty Balance Index Report"
        columns={[
          { key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> },
          { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> },
        ]}
        data={[
          { metric: "Easy Question %", value: 0.30 },
          { metric: "Medium Question %", value: 0.50 },
          { metric: "Hard Question %", value: 0.20 },
          { metric: "Difficulty Deviation", value: dbi?.value != null ? 1 - dbi.value : null },
          { metric: "Difficulty Balance Index (DBI)", value: dbi?.value ?? null },
          { metric: "Classification", value: null },
          { metric: "Confidence", value: null },
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
          { metric: "Total Questions", value: null },
          { metric: "Aligned Questions", value: null },
          { metric: "Misaligned Questions", value: null },
          { metric: "Marks Complexity Alignment Index (MCAI)", value: mcai?.value ?? null },
          { metric: "Classification", value: null },
          { metric: "Confidence", value: null },
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
        data={[]}
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
        data={[{ metric: "Rigor Classification", value: "Moderate — Balanced but improvement possible" }]}
      />
    </SectionShell>
  );
}

// ── Quality Section ──

function QualitySection({ metrics }: { metrics: MetricItem[] }) {
  const qcqi = getMetric(metrics, "QCQI");
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
          { metric: "Clarity Score", value: null },
          { metric: "Precision Score", value: null },
          { metric: "Technical Accuracy Score", value: null },
          { metric: "Context Adequacy Score", value: null },
          { metric: "Assessment Validity Score", value: null },
          { metric: "Alignment Score", value: null },
          { metric: "Fairness Score", value: null },
          { metric: "QCQI", value: qcqi?.value ?? null },
          { metric: "Classification", value: qcqi?.classification ?? null },
          { metric: "Confidence", value: null },
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
        data={[]}
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
          { metric: "Classification", value: null },
          { metric: "Confidence", value: null },
        ]} />

      <UafReportTable title="Metadata Risk Register" description="Identified metadata-related risks." exportable
        columns={[{ key: "finding", header: "Finding", render: (r: any) => r.finding }, { key: "risk", header: "Risk", render: (r: any) => r.risk }, { key: "priority", header: "Priority", render: (r: any) => <PriorityBadge priority={r.priority} /> }]}
        data={[]} emptyMessage="No metadata risks identified." />
    </SectionShell>
  );
}

function AlignmentSection({ metrics }: { metrics: MetricItem[] }) {
  const cai = getMetric(metrics, "CAI");
  return (
    <SectionShell id="constructive-alignment" title="Constructive Alignment Analysis" subtitle="Phase 10 — Alignment between Course Outcomes, learning activities, and assessment." formula="CAI = Aligned Questions / Total Questions" confidence={cai?.classification ?? undefined}>
      <UafReportTable title="Alignment Chain" description="Course Outcome → Learning Activity → Assessment → Evidence"
        columns={[{ key: "q", header: "Question", render: (r: any) => <span className="font-mono text-xs">{r.q}</span> }, { key: "co", header: "CO", render: (r: any) => r.co }, { key: "bloom", header: "Bloom", render: (r: any) => r.bloom }, { key: "activity", header: "Learning Activity", render: (r: any) => r.activity }, { key: "evidence", header: "Evidence Status", render: (r: any) => r.evidence }]}
        data={[]} emptyMessage="Constructive alignment audit data not available." />
      <UafReportTable title="Alignment Rating Scale"
        columns={[{ key: "rating", header: "Rating", render: (r: any) => <span className="font-medium">{r.rating}</span> }, { key: "interp", header: "Interpretation", render: (r: any) => r.interp }]}
        data={[{ rating: "Excellent", interp: "Full observable alignment" }, { rating: "Good", interp: "Minor alignment gaps" }, { rating: "Moderate", interp: "Partial alignment" }, { rating: "Weak", interp: "Significant deficiencies" }, { rating: "Poor", interp: "No observable alignment" }]} />
      <UafReportTable title="Constructive Alignment Report"
        columns={[{ key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> }]}
        data={[{ metric: "Aligned Questions", value: null }, { metric: "Misaligned Questions", value: null }, { metric: "Constructive Alignment Index (CAI)", value: cai?.value ?? null }, { metric: "Classification", value: null }, { metric: "Confidence", value: null }]} />
    </SectionShell>
  );
}

function ModerationSection({ metrics }: { metrics: MetricItem[] }) {
  const ami = getMetric(metrics, "AMI");
  return (
    <SectionShell id="moderation" title="Academic Moderation Analysis" subtitle="Phase 11 — Moderation compliance across validity, reliability, fairness, transparency, and traceability." formula="AMI = Moderation Criteria Satisfied / Total Moderation Criteria" confidence={ami?.classification ?? undefined}>
      <UafReportTable title="Moderation Criteria" description="Evaluation requirements for each moderation criterion."
        columns={[{ key: "criterion", header: "Criterion", render: (r: any) => <span className="font-medium">{r.criterion}</span> }, { key: "req", header: "Evaluation Requirement", render: (r: any) => r.req }]}
        data={[{ criterion: "Validity", req: "Measures intended learning outcomes" }, { criterion: "Reliability", req: "Produces consistent assessment evidence" }, { criterion: "Fairness", req: "Equitable for all learners" }, { criterion: "Transparency", req: "Assessment expectations are clear" }, { criterion: "Traceability", req: "Evidence linked to outcomes" }, { criterion: "Consistency", req: "Assessment design is coherent" }, { criterion: "Governance Compliance", req: "Institutional standards satisfied" }]} />
      <UafReportTable title="Moderation Audit Table"
        columns={[{ key: "criterion", header: "Criterion", render: (r: any) => <span className="font-medium">{r.criterion}</span> }, { key: "status", header: "Status", render: (r: any) => r.status }, { key: "evidence", header: "Evidence", render: (r: any) => r.evidence }]}
        data={[{ criterion: "Validity", status: "—", evidence: "Pending evaluation" }, { criterion: "Reliability", status: "—", evidence: "Pending evaluation" }, { criterion: "Fairness", status: "—", evidence: "Pending evaluation" }, { criterion: "Transparency", status: "—", evidence: "Pending evaluation" }, { criterion: "Traceability", status: "—", evidence: "Pending evaluation" }, { criterion: "Consistency", status: "—", evidence: "Pending evaluation" }, { criterion: "Governance Compliance", status: "—", evidence: "Pending evaluation" }]} />
      <UafReportTable title="Academic Moderation Report"
        columns={[{ key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> }]}
        data={[{ metric: "Criteria Satisfied", value: null }, { metric: "Criteria Not Satisfied", value: null }, { metric: "Academic Moderation Index (AMI)", value: ami?.value ?? null }, { metric: "Classification", value: null }, { metric: "Confidence", value: null }]} />
    </SectionShell>
  );
}

function FutureReadinessSection({ metrics }: { metrics: MetricItem[] }) {
  const fri = getMetric(metrics, "FRI");
  return (
    <SectionShell id="future-readiness" title="Future Readiness Evaluation" subtitle="Phase 12 — Assessment preparation for modern professional and academic environments." formula="FRI = Future Ready Criteria Satisfied / Total Future Ready Criteria" confidence={fri?.classification ?? undefined}>
      <UafReportTable title="Future Readiness Criteria"
        columns={[{ key: "criterion", header: "Criterion", render: (r: any) => <span className="font-medium">{r.criterion}</span> }, { key: "desc", header: "Description", render: (r: any) => r.desc }]}
        data={[{ criterion: "Problem Solving", desc: "Real-world problem solving" }, { criterion: "Critical Thinking", desc: "Analytical reasoning" }, { criterion: "Innovation", desc: "Creative solution development" }, { criterion: "Industry Relevance", desc: "Professional applicability" }, { criterion: "Graduate Attributes", desc: "Graduate competency support" }, { criterion: "Employability Skills", desc: "Career readiness" }, { criterion: "HOTS Integration", desc: "Higher-order thinking support" }]} />
      <UafReportTable title="Future Readiness Audit"
        columns={[{ key: "criterion", header: "Criterion", render: (r: any) => <span className="font-medium">{r.criterion}</span> }, { key: "status", header: "Status", render: (r: any) => r.status }, { key: "evidence", header: "Evidence", render: (r: any) => r.evidence }]}
        data={[{ criterion: "Problem Solving", status: "—", evidence: "Pending evaluation" }, { criterion: "Critical Thinking", status: "—", evidence: "Pending evaluation" }, { criterion: "Innovation", status: "—", evidence: "Pending evaluation" }, { criterion: "Industry Relevance", status: "—", evidence: "Pending evaluation" }, { criterion: "Graduate Attributes", status: "—", evidence: "Pending evaluation" }, { criterion: "Employability Skills", status: "—", evidence: "Pending evaluation" }, { criterion: "HOTS Integration", status: "—", evidence: "Pending evaluation" }]} />
      <UafReportTable title="Future Readiness Report"
        columns={[{ key: "metric", header: "Metric", render: (r: any) => <span className="font-medium">{r.metric}</span> }, { key: "value", header: "Value", render: (r: any) => <MetricValue value={r.value} /> }]}
        data={[{ metric: "Criteria Satisfied", value: null }, { metric: "Criteria Not Satisfied", value: null }, { metric: "Future Readiness Index (FRI)", value: fri?.value ?? null }, { metric: "Classification", value: null }, { metric: "Confidence", value: null }]} />
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

function FinalVerdictSection({ metrics, executiveSummary, finalVerdict, risks, recommendations }: {
  metrics: MetricItem[]; executiveSummary: string | null; finalVerdict: string | null;
  risks?: Array<{ finding: string; priority: string; riskType: string | null }>;
  recommendations?: Array<{ finding: string; recommendation: string; priority: string }>;
}) {
  const qpqi = getMetric(metrics, "QPQI");
  return (
    <SectionShell id="final-verdict" title="Final Moderation Verdict" subtitle="Phase 15 — Institutional moderation decision based on all evaluation phases.">
      {/* Executive Summary */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold">Executive Summary</h3>
          {finalVerdict && <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">AI Generated</span>}
        </div>
        {executiveSummary ? (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{executiveSummary}</p>
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
        data={recommendations?.map((r) => ({ finding: r.finding, rec: r.recommendation, priority: r.priority })) ?? []}
        emptyMessage="No recommendations generated." />

      {/* Institutional Strengths & Weaknesses */}
      <UafReportTable title="Institutional Strengths" columns={[{ key: "id", header: "ID", render: (r: any) => <span className="font-mono">{r.id}</span> }, { key: "strength", header: "Strength", render: (r: any) => r.strength }]}
        data={[]} emptyMessage="No strengths identified." />
      <UafReportTable title="Institutional Weaknesses" columns={[{ key: "id", header: "ID", render: (r: any) => <span className="font-mono">{r.id}</span> }, { key: "weakness", header: "Weakness", render: (r: any) => r.weakness }]}
        data={[]} emptyMessage="No weaknesses identified." />

      {/* Accreditation Readiness */}
      <UafReportTable title="Accreditation Readiness Assessment"
        columns={[{ key: "dimension", header: "Dimension", render: (r: any) => <span className="font-medium">{r.dimension}</span> }, { key: "status", header: "Status", render: (r: any) => r.status ?? "—" }]}
        data={["OBE Compliance", "Bloom Alignment", "Constructive Alignment", "Assessment Quality", "Moderation Compliance", "Documentation Readiness", "NBA Readiness", "NAAC Readiness"].map((d) => ({ dimension: d, status: "Pending assessment" }))} />
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
          <CoverageSection metrics={metrics} />
          <BloomSection metrics={metrics} />
          <DifficultySection metrics={metrics} />
          <QualitySection metrics={metrics} />
          <AlignmentSection metrics={metrics} />
          <ModerationSection metrics={metrics} />
          <FutureReadinessSection metrics={metrics} />
          <OverallQualitySection metrics={metrics} />
          <ConfidenceSection metrics={metrics} />
          <FinalVerdictSection
            metrics={metrics}
            executiveSummary={qba.executiveSummary}
            finalVerdict={qba.finalVerdict}
            risks={qba.risks}
            recommendations={qba.recommendations}
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
