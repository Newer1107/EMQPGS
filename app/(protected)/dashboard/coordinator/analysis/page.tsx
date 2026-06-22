"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { UafAnalysisOverview } from "@/components/dean/uaf-analysis-overview";
import { UafVersionHistory } from "@/components/dean/uaf-version-history";
import { UafVersionCompare } from "@/components/dean/uaf-version-compare";
import { apiFetch } from "@/lib/client-fetch";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default function CoordinatorAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = searchParams.get("bank");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!bankId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/question-banks/${bankId}/analysis/versions`);
        const body = await res.json();
        if (!cancelled) {
          if (body.success && Array.isArray(body.data) && body.data.length > 0) {
            setCurrentVersionId(body.data[0].id);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setError("Failed to load analysis data."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [bankId, refreshKey]);

  const handleCompare = useCallback((versionId: string) => {
    setCompareVersionId((prev) => (prev === versionId ? null : versionId));
  }, []);

  if (!bankId) {
    return (
      <div className="space-y-6">
        <PageHeader title="UAF Analysis" description="Select a question bank to view its analysis." />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
            <p className="text-lg font-medium">No question bank selected</p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Choose a bank from the Coordinator dashboard to view its UAF analysis.</p>
            <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard/coordinator")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="UAF Analysis" description="Loading analysis data…" />
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
            <Button className="mt-4" variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/coordinator")} title="Back to Dashboard">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="UAF Analysis"
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
