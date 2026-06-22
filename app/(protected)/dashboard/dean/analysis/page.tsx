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

interface BankInfo {
  id: string;
  subjectName: string;
  subjectCode: string;
}

export default function DeanAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = searchParams.get("bank");

  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch bank info for the header
  useEffect(() => {
    if (!bankId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/question-banks/${bankId}/analysis/versions`);
        const body = await res.json();
        if (!cancelled) {
          if (body.success && Array.isArray(body.data) && body.data.length > 0) {
            setCurrentVersionId(body.data[0].id);
          }
          // Attempt to get bank name; if unavailable, just show the ID
          setBankInfo({ id: bankId, subjectName: "Question Bank", subjectCode: bankId.slice(0, 8) });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load analysis data.");
          setLoading(false);
        }
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
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Go to the Dean dashboard and click "UAF Analysis" on a pending review.</p>
            <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard/dean")}>
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
      {/* Header with back navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/dean")} title="Back to Dean Dashboard">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={`UAF Analysis — ${bankInfo?.subjectCode ?? bankId}`}
          description="Deterministic academic quality indices and AI-assisted interpretation for this question bank."
        />
      </div>

      {/* Main analysis overview with index summary table and executive summary */}
      <UafAnalysisOverview questionBankId={bankId} />

      {/* Version history and comparison */}
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
