"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { apiFetch } from "@/lib/client-fetch";
import { Play, RefreshCw, BarChart3, ArrowRight } from "lucide-react";

interface BankEvaluationStatus {
  id: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  batch: string;
  academicYear: string;
  hasEvaluation: boolean;
  latestVerdict?: string;
  latestScore?: number;
  latestDate?: string;
}

function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case "Highly Effective": return "text-green-600 bg-green-50 border-green-200";
    case "Moderately Effective": return "text-amber-600 bg-amber-50 border-amber-200";
    case "Needs Revision": return "text-red-600 bg-red-50 border-red-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export default function CoordinatorEvaluationPage() {
  const [banks, setBanks] = useState<BankEvaluationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/analysis/available-banks");
        const body = await res.json();
        if (!cancelled && body.success && Array.isArray(body.data)) {
          // Fetch latest evaluation for each bank
          const enriched = await Promise.all(
            body.data.map(async (bank: { id: string; subjectName: string; subjectCode: string; semester: number; batch: string; academicYear: string }) => {
              try {
                const evalRes = await apiFetch(`/api/question-banks/${bank.id}/evaluation`);
                const evalBody = await evalRes.json();
                const hasEval = !evalBody.notFound && evalBody.versions?.[0]?.analysisSnapshot?.fullReport;
                const report = hasEval ? evalBody.versions[0].analysisSnapshot.fullReport : null;
                return {
                  ...bank,
                  hasEvaluation: !!hasEval,
                  latestVerdict: report?.verdict?.verdict,
                  latestScore: report?.verdict?.overallScore,
                  latestDate: evalBody.completedAt,
                } as BankEvaluationStatus;
              } catch {
                return { ...bank, hasEvaluation: false } as BankEvaluationStatus;
              }
            }),
          );
          if (!cancelled) setBanks(enriched);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleEvaluate = useCallback(async (bankId: string) => {
    setRunningIds((prev) => new Set(prev).add(bankId));
    try {
      await apiFetch(`/api/question-banks/${bankId}/evaluation`, { method: "POST" });
      // Refresh
      const refreshRes = await apiFetch(`/api/question-banks/${bankId}/evaluation`);
      const refreshBody = await refreshRes.json();
      if (!refreshBody.notFound && refreshBody.versions?.[0]?.analysisSnapshot?.fullReport) {
        const report = refreshBody.versions[0].analysisSnapshot.fullReport;
        setBanks((prev) =>
          prev.map((b) =>
            b.id === bankId
              ? { ...b, hasEvaluation: true, latestVerdict: report.verdict.verdict, latestScore: report.verdict.overallScore, latestDate: new Date().toISOString() }
              : b
          )
        );
      }
    } catch { /* ignore */ }
    setRunningIds((prev) => { const next = new Set(prev); next.delete(bankId); return next; });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Question Bank Evaluation" description="Loading question banks…" />
        <LoadingSkeleton variant="card" className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Bank Evaluation"
        description={`${banks.length} question bank${banks.length !== 1 ? "s" : ""} available for academic quality evaluation.`}
      />

      {banks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
            <p className="text-lg font-medium">No question banks found</p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Banks appear here once they are created and accessible to you.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banks.map((bank) => {
            const isRunning = runningIds.has(bank.id);
            return (
              <div
                key={bank.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4 transition-colors hover:bg-[var(--surface-hover)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {bank.subjectName} <span className="font-normal text-[var(--text-tertiary)]">({bank.subjectCode})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    Sem {bank.semester} · {bank.batch} · {bank.academicYear}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {bank.hasEvaluation ? (
                      <>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getVerdictColor(bank.latestVerdict ?? "N/A")}`}>
                          {bank.latestVerdict ?? "N/A"}
                        </span>
                        {bank.latestScore != null && (
                          <span className="text-xs text-[var(--text-tertiary)]">
                            Score: {(bank.latestScore * 100).toFixed(0)}%
                          </span>
                        )}
                        {bank.latestDate && (
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {new Date(bank.latestDate).toLocaleDateString()}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)] italic">No evaluation yet</span>
                    )}
                  </div>
                </div>

                <div className="ml-4 shrink-0 flex items-center gap-2">
                  {bank.hasEvaluation && (
                    <Link
                      href={`/dashboard/coordinator/question-banks/${bank.id}/evaluation`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                  <Button
                    variant={bank.hasEvaluation ? "outline" : "default"}
                    size="sm"
                    disabled={isRunning}
                    onClick={() => handleEvaluate(bank.id)}
                  >
                    {isRunning ? (
                      <><RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> Running…</>
                    ) : (
                      <><Play className="mr-1 h-3.5 w-3.5" /> {bank.hasEvaluation ? "Re-run" : "Evaluate"}</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
