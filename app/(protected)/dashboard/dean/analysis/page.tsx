"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { UafAnalysisOverview } from "@/components/dean/uaf-analysis-overview";
import { UafVersionHistory } from "@/components/dean/uaf-version-history";
import { UafVersionCompare } from "@/components/dean/uaf-version-compare";
import { apiFetch } from "@/lib/client-fetch";
import { ArrowLeft, BarChart3, Play, RefreshCw } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────

interface AnalysisStatus {
  id: string;
  status: string;
  qpqi: number | null;
  qpqiClassification: string | null;
  version: number;
  completedAt: string | null;
}

interface LockedBank {
  id: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  batch: string;
  academicYear: string;
  createdAt: string;
  latestAnalysis: AnalysisStatus | null;
}

// ── Helpers ─────────────────────────────────────────────────────

function getClassificationColor(c: string | null): string {
  if (!c) return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  const map: Record<string, string> = {
    EXEMPLARY: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    HIGHLY_EFFECTIVE: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
    EFFECTIVE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    ACCEPTABLE: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    NEEDS_IMPROVEMENT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    MAJOR_REVISION_REQUIRED: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
  };
  return map[c] ?? "bg-gray-100 text-gray-700";
}

function getStatusBadge(status: string): { label: string; variant: "default" | "success" | "warning" | "info" } {
  switch (status) {
    case "COMPLETE": return { label: "Complete", variant: "success" };
    case "AI_COMPLETE": return { label: "AI Done", variant: "info" };
    case "AI_PENDING": return { label: "Analyzing…", variant: "warning" };
    case "COMPUTING": return { label: "Computing", variant: "warning" };
    case "FAILED": return { label: "Failed", variant: "default" };
    default: return { label: status, variant: "default" };
  }
}

// ── Bank List Component ─────────────────────────────────────────

function BankListView({
  banks,
  onTriggerAnalysis,
  runningIds,
}: {
  banks: LockedBank[];
  onTriggerAnalysis: (id: string) => void;
  runningIds: Set<string>;
}) {
  if (banks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
          <p className="text-lg font-medium">No locked question banks</p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Banks appear here once they reach the COMPLETE phase and are locked.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {banks.map((bank) => {
        const analysis = bank.latestAnalysis;
        const isRunning = runningIds.has(bank.id);
        return (
          <div
            key={bank.id}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4 transition-colors hover:bg-[var(--surface-hover)]"
          >
            {/* Bank info — clickable to view existing analysis */}
            <a
              href={`/dashboard/dean/analysis?bank=${bank.id}`}
              className="min-w-0 flex-1"
            >
              <p className="text-sm font-semibold">
                {bank.subjectName} <span className="font-normal text-[var(--text-tertiary)]">({bank.subjectCode})</span>
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                Sem {bank.semester} · {bank.batch} · {bank.academicYear}
              </p>
              {/* Analysis status row */}
              <div className="mt-2 flex items-center gap-2">
                {analysis ? (
                  <>
                    <Badge variant={getStatusBadge(analysis.status).variant}>
                      {getStatusBadge(analysis.status).label} v{analysis.version}
                    </Badge>
                    {analysis.qpqi != null && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getClassificationColor(analysis.qpqiClassification)}`}>
                        QPQI: {(analysis.qpqi * 100).toFixed(0)}
                      </span>
                    )}
                    {analysis.completedAt && (
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {new Date(analysis.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[var(--text-tertiary)] italic">No analysis yet</span>
                )}
              </div>
            </a>

            {/* Trigger / View button */}
            <div className="ml-4 shrink-0 flex items-center gap-2">
              {analysis && (
                <a
                  href={`/dashboard/dean/analysis?bank=${bank.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-hover)]"
                >
                  View Details
                </a>
              )}
              <Button
                variant={analysis ? "outline" : "default"}
                size="sm"
                disabled={isRunning}
                onClick={() => onTriggerAnalysis(bank.id)}
              >
                {isRunning ? (
                  <><RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> Running…</>
                ) : (
                  <><Play className="mr-1 h-3.5 w-3.5" /> {analysis ? "Re-run" : "Run Analysis"}</>
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Analysis Detail View ────────────────────────────────────────

function AnalysisDetailView({
  bankId,
  onBack,
}: {
  bankId: string;
  onBack: () => void;
}) {
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/question-banks/${bankId}/analysis/versions`);
        const body = await res.json();
        if (!cancelled && body.success && Array.isArray(body.data) && body.data.length > 0) {
          setCurrentVersionId(body.data[0].id);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [bankId]);

  const handleCompare = useCallback((versionId: string) => {
    setCompareVersionId((prev) => (prev === versionId ? null : versionId));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back to bank list">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="UAF Analysis Details"
          description="Deterministic academic quality indices for this question bank."
        />
      </div>

      <UafAnalysisOverview questionBankId={bankId} />

      <div className="grid gap-6 lg:grid-cols-2">
        <UafVersionHistory
          questionBankId={bankId}
          currentVersionId={currentVersionId ?? undefined}
          onCompare={handleCompare}
          selectionMode={true}
        />
        {compareVersionId && currentVersionId && (
          <UafVersionCompare
            questionBankId={bankId}
            versionA={{ id: currentVersionId, versionNumber: 0, createdAt: "" }}
            versionB={{ id: compareVersionId, versionNumber: 0, createdAt: "" }}
            onClose={() => setCompareVersionId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export default function DeanAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = searchParams.get("bank");

  const [banks, setBanks] = useState<LockedBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  // Fetch locked banks
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/analysis/available-banks");
        const body = await res.json();
        if (!cancelled) {
          if (body.success && Array.isArray(body.data)) {
            setBanks(body.data);
          } else {
            setError(body.error?.message ?? "Failed to load banks");
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setError("Unable to reach the server."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Trigger analysis for a specific bank
  const handleTriggerAnalysis = useCallback(async (bankId: string) => {
    setRunningIds((prev) => new Set(prev).add(bankId));
    try {
      const res = await apiFetch(`/api/question-banks/${bankId}/analysis`, { method: "POST" });
      const body = await res.json();
      if (body.success) {
        // Refresh bank list to update status
        const refreshRes = await apiFetch("/api/analysis/available-banks");
        const refreshBody = await refreshRes.json();
        if (refreshBody.success && Array.isArray(refreshBody.data)) {
          setBanks(refreshBody.data);
        }
      }
    } catch { /* ignore */ }
    setRunningIds((prev) => { const next = new Set(prev); next.delete(bankId); return next; });
  }, []);

  // If a bank is selected, show analysis detail
  if (bankId) {
    return (
      <AnalysisDetailView
        bankId={bankId}
        onBack={() => router.push("/dashboard/dean/analysis")}
      />
    );
  }

  // Show bank list
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="UAF Analysis" description="Loading question banks…" />
        <LoadingSkeleton variant="card" className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="UAF Analysis" description={error} />
        <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="py-8 text-center">
            <p className="text-red-800 dark:text-red-300">{error}</p>
            <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="UAF Analysis"
        description={`${banks.length} locked question bank${banks.length !== 1 ? "s" : ""} ready for academic quality analysis.`}
      />

      <BankListView
        banks={banks}
        onTriggerAnalysis={handleTriggerAnalysis}
        runningIds={runningIds}
      />
    </div>
  );
}
