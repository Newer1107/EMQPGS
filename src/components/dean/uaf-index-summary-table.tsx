"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ── Index metadata ──────────────────────────────────────────────

const INDEX_META: Record<string, { label: string; description: string }> = {
  SCI: { label: "Slot Coverage Index", description: "Proportion of question slots filled in the bank." },
  MII: { label: "Metadata Integrity Index", description: "Mean of 9 sub-metrics measuring CO, PO, PI, RBT, difficulty, marks, question type, metadata completeness, and consistency." },
  BDI: { label: "Bloom Distribution Index", description: "How evenly questions are distributed across Bloom's taxonomy levels (L1–L6)." },
  CVI: { label: "CO Verification Index", description: "Coverage of Course Outcomes — how many of the 6 standard COs are addressed." },
  MCAI: { label: "Marks–Cognitive Alignment Index", description: "Alignment between assigned marks and the cognitive complexity of each question." },
  DBI: { label: "Difficulty Balance Index", description: "How closely the difficulty distribution matches the ideal (30% Easy, 50% Medium, 20% Hard)." },
  QCQI: { label: "Question Content Quality Index", description: "Evaluates clarity, precision, technical accuracy, context, validity, alignment, and fairness." },
  CAI: { label: "Constructive Alignment Index", description: "Proportion of questions with both CO mapping and RBT level assigned." },
  AMI: { label: "Assessment Moderation Index", description: "Satisfaction of moderation criteria for assessment quality." },
  FRI: { label: "Future Readiness Index", description: "Readiness of the question bank for future academic requirements." },
  QPQI: { label: "Question Paper Quality Index", description: "Weighted composite of all 10 core indices — the overall quality score." },
};

export function getIndexMeta(indexCode: string) {
  return INDEX_META[indexCode] ?? { label: indexCode, description: "" };
}

// ── Classification helpers ──────────────────────────────────────

const CLASSIFICATION_STYLES: Record<string, { badge: string; text: string; bar: string }> = {
  EXEMPLARY: {
    badge: "border-green-700/30 bg-green-50 text-green-800 dark:border-green-400/30 dark:bg-green-950 dark:text-green-300",
    text: "text-green-800 dark:text-green-300",
    bar: "bg-green-600 dark:bg-green-500",
  },
  HIGHLY_EFFECTIVE: {
    badge: "border-lime-600/30 bg-lime-50 text-lime-800 dark:border-lime-400/30 dark:bg-lime-950 dark:text-lime-300",
    text: "text-lime-800 dark:text-lime-300",
    bar: "bg-lime-600 dark:bg-lime-500",
  },
  EFFECTIVE: {
    badge: "border-yellow-500/30 bg-yellow-50 text-yellow-800 dark:border-yellow-400/30 dark:bg-yellow-950 dark:text-yellow-300",
    text: "text-yellow-800 dark:text-yellow-300",
    bar: "bg-yellow-500 dark:bg-yellow-400",
  },
  ACCEPTABLE: {
    badge: "border-orange-500/30 bg-orange-50 text-orange-800 dark:border-orange-400/30 dark:bg-orange-950 dark:text-orange-300",
    text: "text-orange-800 dark:text-orange-300",
    bar: "bg-orange-500 dark:bg-orange-400",
  },
  NEEDS_IMPROVEMENT: {
    badge: "border-red-500/30 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-950 dark:text-red-300",
    text: "text-red-800 dark:text-red-300",
    bar: "bg-red-500 dark:bg-red-400",
  },
  MAJOR_REVISION_REQUIRED: {
    badge: "border-red-800/30 bg-red-100 text-red-900 dark:border-red-600/30 dark:bg-red-950 dark:text-red-200",
    text: "text-red-900 dark:text-red-200",
    bar: "bg-red-800 dark:bg-red-600",
  },
};

export function classificationStyle(classification: string | null) {
  return CLASSIFICATION_STYLES[classification ?? ""] ?? {
    badge: "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-tertiary)]",
    text: "text-[var(--text-tertiary)]",
    bar: "bg-[var(--text-tertiary)]",
  };
}

export function formatClassification(classification: string | null): string {
  if (!classification) return "—";
  return classification.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Types ───────────────────────────────────────────────────────

export interface IndexMetric {
  indexCode: string;
  value: number | null;
  classification: string | null;
  weight: number | null;
  weightedScore: number | null;
}

interface UafIndexSummaryTableProps {
  metrics: IndexMetric[];
  showWeights?: boolean;
  className?: string;
}

// ── Component ───────────────────────────────────────────────────

export function UafIndexSummaryTable({ metrics, showWeights = false, className }: UafIndexSummaryTableProps) {
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  if (!metrics.length) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-6 text-center text-sm text-[var(--text-tertiary)]">
        No metric data available.
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-[var(--border)]", className)}>
      <Table>
        <THead>
          <TR>
            <TH className="w-[180px]">Index</TH>
            <TH className="w-24">Value</TH>
            <TH className="w-44">Classification</TH>
            {showWeights ? <TH className="w-20 text-right">Weight</TH> : null}
            {showWeights ? <TH className="w-28 text-right">Weighted Score</TH> : null}
            <TH />
          </TR>
        </THead>
        <TBody>
          {metrics.map((m) => {
            const meta = getIndexMeta(m.indexCode);
            const style = classificationStyle(m.classification);
            const pct = m.value !== null ? Math.round(m.value * 100) : null;
            const expanded = expandedIndex === m.indexCode;

            return (
              <TR key={m.indexCode}>
                <TD className="font-medium">{meta.label}</TD>
                <TD>
                  <span className={cn("tabular-nums font-semibold", m.value !== null ? style.text : "text-[var(--text-tertiary)]")}>
                    {pct !== null ? `${pct}%` : "—"}
                  </span>
                  {/* Value bar */}
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                    <div
                      className={cn("h-full rounded-full transition-all", style.bar)}
                      style={{ width: pct !== null ? `${Math.min(100, pct)}%` : "0%" }}
                    />
                  </div>
                </TD>
                <TD>
                  <Badge className={cn("text-xs", style.badge)}>
                    {formatClassification(m.classification)}
                  </Badge>
                </TD>
                {showWeights ? (
                  <TD className="text-right tabular-nums text-[var(--text-tertiary)]">
                    {m.weight !== null ? `${(m.weight * 100).toFixed(0)}%` : "—"}
                  </TD>
                ) : null}
                {showWeights ? (
                  <TD className="text-right tabular-nums font-medium">
                    {m.weightedScore !== null ? (m.weightedScore * 100).toFixed(1) : "—"}
                  </TD>
                ) : null}
                <TD className="w-10 text-right">
                  <button
                    type="button"
                    onClick={() => setExpandedIndex(expanded ? null : m.indexCode)}
                    className="text-xs text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-primary)]"
                  >
                    {expanded ? "less" : "more"}
                  </button>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      {/* Expandable detail panel */}
      {expandedIndex ? (
        <div className="border-t border-[var(--border-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text-primary)]">{getIndexMeta(expandedIndex).label}</p>
          <p className="mt-1">{getIndexMeta(expandedIndex).description}</p>
          {(() => {
            const m = metrics.find((x) => x.indexCode === expandedIndex);
            if (!m) return null;
            return (
              <div className="mt-2 flex gap-6 text-xs text-[var(--text-tertiary)]">
                {m.weight !== null ? <span>Weight: {(m.weight * 100).toFixed(0)}%</span> : null}
                {m.weightedScore !== null ? <span>Weighted score: {(m.weightedScore * 100).toFixed(2)}</span> : null}
                <span>Raw value: {m.value !== null ? m.value.toFixed(4) : "N/A"}</span>
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
