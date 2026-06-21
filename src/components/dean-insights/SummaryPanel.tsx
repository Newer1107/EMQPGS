"use client";

import type { InsightsApiResponse, GenerationTrace } from "./types";

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Acceptable";
  return "Needs Review";
}

type StatItem = {
  label: string;
  value: string;
  color?: string;
};

export function SummaryPanel({ data, trace }: { data: InsightsApiResponse; trace: GenerationTrace | null }) {
  const overall = Math.round(data.evaluationReport.overall);
  const color = scoreColor(overall);
  const stats: StatItem[] = [
    { label: "Search Strategy", value: trace?.stats.strategyName ?? "N/A" },
    {
      label: "Generation Time",
      value: trace?.stats.durationMs != null ? `${(trace.stats.durationMs / 1000).toFixed(1)}s` : (data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "N/A"),
    },
    { label: "Candidates Evaluated", value: String(trace?.stats.candidatesEvaluated ?? "N/A") },
    { label: "Candidates Rejected", value: String(trace?.stats.candidatesRejectedByConstraints ?? "N/A") },
    { label: "Evaluation Profile", value: trace?.stats.profileId ?? "N/A" },
    { label: "Coverage Score", value: data.coverageScore != null ? `${data.coverageScore}%` : "N/A" },
    { label: "Difficulty Score", value: data.difficultyScore != null ? `${data.difficultyScore}/100` : "N/A" },
    { label: "Duplicate Risk", value: data.duplicateRisk != null ? `${data.duplicateRisk}%` : "N/A" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 rounded-xl border border-[var(--border)] p-6">
        <div className="flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 text-2xl font-bold" style={{ borderColor: color, color }}>
            {overall}
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em]" style={{ color }}>
            {scoreLabel(overall)}
          </p>
        </div>
        <div className="flex-1 space-y-1">
          <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${overall}%`, background: `linear-gradient(90deg, #ef4444, #f59e0b 40%, #22c55e 80%)` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
            <span>0</span>
            <span>Paper Quality Score — {overall}/100</span>
            <span>100</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{stat.label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums" style={stat.color ? { color: stat.color } : undefined}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {data.recommendation && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">AI Recommendation</p>
          <p className="mt-1 text-sm leading-6">{data.recommendation}</p>
        </div>
      )}
    </div>
  );
}
