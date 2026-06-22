"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { apiFetch } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";
import { UafIndexSummaryTable, type IndexMetric, classificationStyle, formatClassification } from "./uaf-index-summary-table";

// ── Types ───────────────────────────────────────────────────────

interface AnalysisVersion {
  id: string;
  versionNumber: number;
  evaluationEngineVersion: string;
  evidenceHash: string | null;
  createdAt: string;
}

interface VersionDetail {
  id: string;
  versionNumber: number;
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
    startedAt: string | null;
    completedAt: string | null;
    failureReason: string | null;
    metrics: IndexMetric[];
  };
}

// ── Final-Verdict helpers ───────────────────────────────────────

const VERDICT_STYLES: Record<string, string> = {
  APPROVED_WITHOUT_MODIFICATION: "text-green-800 bg-green-50 border-green-700/30 dark:text-green-300 dark:bg-green-950 dark:border-green-400/30",
  APPROVED_WITH_MINOR_IMPROVEMENTS: "text-lime-800 bg-lime-50 border-lime-600/30 dark:text-lime-300 dark:bg-lime-950 dark:border-lime-400/30",
  APPROVED_SUBJECT_TO_REVISION: "text-yellow-800 bg-yellow-50 border-yellow-500/30 dark:text-yellow-300 dark:bg-yellow-950 dark:border-yellow-400/30",
  MAJOR_REVISION_REQUIRED: "text-red-800 bg-red-50 border-red-500/30 dark:text-red-300 dark:bg-red-950 dark:border-red-400/30",
  NOT_APPROVED: "text-red-900 bg-red-100 border-red-800/30 dark:text-red-200 dark:bg-red-950 dark:border-red-600/30",
};

function formatVerdict(verdict: string | null): string {
  if (!verdict) return "—";
  return verdict.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ───────────────────────────────────────────────────

interface UafAnalysisOverviewProps {
  questionBankId: string;
  className?: string;
}

export function UafAnalysisOverview({ questionBankId, className }: UafAnalysisOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versionDetail, setVersionDetail] = useState<VersionDetail | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        // 1. Fetch versions list to find latest
        const versionsRes = await apiFetch(`/api/question-banks/${questionBankId}/analysis/versions`);
        if (!active) return;

        if (!versionsRes.ok) {
          const body = await versionsRes.json().catch(() => ({ error: { message: "Failed to load analysis." } }));
          setError(body.error?.message ?? "Failed to load analysis.");
          setLoading(false);
          return;
        }

        const versionsResult = await versionsRes.json();
        if (!versionsResult.success) {
          setError(versionsResult.error?.message ?? "Failed to load analysis.");
          setLoading(false);
          return;
        }

        const versions: AnalysisVersion[] = versionsResult.data ?? [];

        if (!versions.length) {
          setLoading(false);
          return; // empty state
        }

        // 2. Fetch latest version details
        const latestId = versions[0]!.id;
        const detailRes = await apiFetch(`/api/question-banks/${questionBankId}/analysis/versions/${latestId}`);
        if (!active) return;

        if (!detailRes.ok) {
          const body = await detailRes.json().catch(() => ({ error: { message: "Failed to load analysis details." } }));
          setError(body.error?.message ?? "Failed to load analysis details.");
          setLoading(false);
          return;
        }

        const detailResult = await detailRes.json();
        if (!detailResult.success) {
          setError(detailResult.error?.message ?? "Failed to load analysis details.");
          setLoading(false);
          return;
        }

        const detail = detailResult.data as VersionDetail;
        setVersionDetail(detail);
        setStatus(detail.questionBankAnalysis.status);
      } catch (err) {
        console.error("[UafAnalysisOverview]", err);
        if (active) setError("Unable to reach the server. Please check your connection.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [questionBankId]);

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>UAF Analysis Overview</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <LoadingSkeleton variant="card" count={2} />
          <LoadingSkeleton variant="table-row" count={5} />
        </CardContent>
      </Card>
    );
  }

  // ── Error state ───────────────────────────────────────────────
  if (error) {
    return (
      <Card className={cn("border-red-500/30", className)}>
        <CardHeader><CardTitle>UAF Analysis Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-red-500/30 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty state ───────────────────────────────────────────────
  if (!versionDetail) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>UAF Analysis Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="text-3xl">🔍</div>
            <p className="font-medium text-[var(--text-primary)]">No analysis available</p>
            <p className="text-sm text-[var(--text-tertiary)]">
              Run an AI-powered UAF analysis to evaluate question bank quality, coverage, and accreditation readiness.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Data state ────────────────────────────────────────────────
  const analysis = versionDetail.questionBankAnalysis;
  const isFailed = analysis.status === "FAILED";
  const qpqiPct = analysis.qpqi !== null ? Math.round(analysis.qpqi * 100) : null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Overall QPQI + Status */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>UAF Analysis Overview</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={analysis.status === "COMPLETE" ? "success" : analysis.status === "FAILED" ? "danger" : "warning"}>
              {analysis.status}
            </Badge>
            <Badge variant="info">v{analysis.version}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFailed ? (
            <div className="rounded-lg border border-red-500/30 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
              <p className="font-medium">Analysis failed</p>
              {analysis.failureReason ? <p className="mt-1">{analysis.failureReason}</p> : null}
            </div>
          ) : null}

          {/* QPQI hero */}
          <div className="flex items-end gap-4 rounded-xl border border-[var(--border)] p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Overall Quality (QPQI)</p>
              {qpqiPct !== null ? (
                <p className={cn("mt-1 text-3xl font-bold tabular-nums", classificationStyle(analysis.qpqiClassification).text)}>
                  {qpqiPct}%
                </p>
              ) : (
                <p className="mt-1 text-3xl font-bold text-[var(--text-tertiary)]">—</p>
              )}
            </div>
            <div className="pb-1">
              <Badge className={cn("text-xs", classificationStyle(analysis.qpqiClassification).badge)}>
                {formatClassification(analysis.qpqiClassification)}
              </Badge>
            </div>
            {analysis.completedAt ? (
              <div className="ml-auto self-start text-xs text-[var(--text-tertiary)]">
                Completed {new Date(analysis.completedAt).toLocaleDateString()}
              </div>
            ) : null}
          </div>

          {/* Executive Summary */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Executive Summary</p>
              <Badge className="border-purple-500/30 bg-purple-50 text-purple-800 text-[10px] dark:bg-purple-950 dark:text-purple-300">
                [AI]
              </Badge>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
              {analysis.executiveSummary ? (
                <p className="text-sm leading-6 text-[var(--text-primary)]">{analysis.executiveSummary}</p>
              ) : (
                <p className="text-sm italic text-[var(--text-tertiary)]">AI-powered executive summary not available.</p>
              )}
            </div>
          </div>

          {/* Final Verdict */}
          {analysis.finalVerdict ? (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Final Verdict</p>
              <div className={cn("inline-block rounded-lg border px-3 py-1.5 text-sm font-medium", VERDICT_STYLES[analysis.finalVerdict] ?? "")}>
                {formatVerdict(analysis.finalVerdict)}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Index Summary Table */}
      <Card>
        <CardHeader><CardTitle>Index Summary</CardTitle></CardHeader>
        <CardContent>
          <UafIndexSummaryTable metrics={analysis.metrics} showWeights />
        </CardContent>
      </Card>

      {/* Accreditation Readiness */}
      {analysis.accreditationReadiness ? (
        <Card>
          <CardHeader><CardTitle>Accreditation Readiness</CardTitle></CardHeader>
          <CardContent>
            <AccreditationReadiness data={analysis.accreditationReadiness} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ── Accreditation Readiness sub-component ───────────────────────

function AccreditationReadiness({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") {
    return <p className="text-sm text-[var(--text-tertiary)]">Accreditation readiness data not available.</p>;
  }

  const record = data as Record<string, unknown>;

  // Try to infer a structured display from the JSON blob
  const entries = Object.entries(record).filter(([, v]) => v !== null && v !== undefined);

  if (!entries.length) {
    return <p className="text-sm text-[var(--text-tertiary)]">Accreditation readiness data is empty.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
            {renderReadinessValue(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function renderReadinessValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return `${(value * 100).toFixed(0)}%`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "—");
}
