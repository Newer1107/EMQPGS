"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/client-fetch";
import type { InsightsApiResponse, GenerationTrace } from "@/components/dean-insights/types";
import { SummaryPanel } from "@/components/dean-insights/SummaryPanel";
import { ScoreCardGrid } from "@/components/dean-insights/ScoreCard";
import { CandidateList } from "@/components/dean-insights/CandidateList";
import { RejectedInspector } from "@/components/dean-insights/RejectedInspector";
import { ComparisonView } from "@/components/dean-insights/ComparisonView";
import { StatisticsPanel } from "@/components/dean-insights/StatisticsPanel";

type TabId = "summary" | "quality" | "candidates" | "rejected" | "comparison" | "statistics";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "quality", label: "Paper Quality" },
  { id: "candidates", label: "Candidate History" },
  { id: "rejected", label: "Rejected Question Inspector" },
  { id: "comparison", label: "Comparison" },
  { id: "statistics", label: "Statistics" },
];

type PaperJson = {
  questionIds: string[];
  evaluationReport: {
    overall: number;
    categories: Array<{
      label: string;
      earned: number;
      max: number;
      deductions: string[];
    }>;
    summary: string;
  };
  scoreBreakdown: string;
  generationTrace?: GenerationTrace;
};

export default function InsightsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const questionBankId = params?.id as string;
  const variant = searchParams?.get("variant") ?? "";

  const [data, setData] = useState<InsightsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  const fetchInsights = useCallback(async () => {
    if (!questionBankId || !variant) return;
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(`/api/question-banks/${questionBankId}/papers/${variant}/insights`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: { message: "Failed to load insights" } }));
        setError(body.error?.message ?? "Failed to load insights");
        setLoading(false);
        return;
      }
      const result = await response.json();
      if (!result.success) {
        setError(result.error?.message ?? "Failed to load insights");
        setLoading(false);
        return;
      }
      setData(result.data as InsightsApiResponse);
    } catch {
      setError("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [questionBankId, variant]);

  useEffect(() => {
    void fetchInsights();
  }, [fetchInsights]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-48 animate-pulse rounded bg-[var(--surface-hover)]" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[var(--surface-hover)]" />
          </div>
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href={`/dashboard/dean/review?bank=${questionBankId}`}
          className="inline-flex items-center text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          ← Back to Review Workspace
        </Link>
        <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-6">
          <p className="text-sm font-medium text-[var(--danger)]">Unable to load insights</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Link
          href={`/dashboard/dean/review?bank=${questionBankId}`}
          className="inline-flex items-center text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          ← Back to Review Workspace
        </Link>
        <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-tertiary)]">
          No data available for the selected paper.
        </div>
      </div>
    );
  }

  const trace: GenerationTrace | null = data.generationTrace;
  const slotDecisions = trace?.slotDecisions ?? [];
  const evaluationReport = data.evaluationReport;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/dean/review?bank=${questionBankId}`}
            className="inline-flex items-center text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-2"
          >
            ← Back to Review Workspace
          </Link>
          <h1 className="text-lg font-semibold">Paper Insights — {variant}</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "N/A"}
            {data.createdAt ? ` · Created ${new Date(data.createdAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/question-banks/${questionBankId}/papers/${variant}/export`}
            className="inline-flex items-center rounded-md bg-[var(--foreground)] px-3 py-2 text-xs font-medium text-[var(--background)] hover:opacity-90 transition-opacity"
            download
          >
            Download DOCX
          </a>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "summary" && <SummaryPanel data={data} trace={trace} />}

        {activeTab === "quality" && (
          <ScoreCardGrid
            cards={evaluationReport.categories.map((cat) => ({
              label: cat.label,
              earned: cat.earned,
              max: cat.max,
              deductions: cat.deductions,
            }))}
          />
        )}

        {activeTab === "candidates" && (
          <CandidateList slotDecisions={slotDecisions} questions={data.questions} />
        )}

        {activeTab === "rejected" && (
          <RejectedInspector slotDecisions={slotDecisions} questions={data.questions} />
        )}

        {activeTab === "comparison" && (
          <ComparisonView slotDecisions={slotDecisions} questions={data.questions} />
        )}

        {activeTab === "statistics" && (
          <StatisticsPanel
            evaluationReport={evaluationReport}
            trace={trace}
            slotDecisions={slotDecisions}
            questions={data.questions}
          />
        )}
      </div>
    </div>
  );
}
