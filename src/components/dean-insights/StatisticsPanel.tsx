"use client";

import { useMemo } from "react";
import { DistributionBar } from "./DistributionBar";
import type { EvaluationReport, SlotDecision, GenerationTrace, InsightQuestion } from "./types";

type StatisticsPanelProps = {
  evaluationReport: EvaluationReport;
  trace: GenerationTrace | null;
  slotDecisions: SlotDecision[];
  questions: InsightQuestion[];
};

function getBloomLevel(level: string): string {
  const map: Record<string, string> = { L1: "Remember", L2: "Understand", L3: "Apply", L4: "Analyze", L5: "Evaluate", L6: "Create" };
  return map[level] ?? level;
}

function getDifficultyLabel(d: string | null): string {
  if (d === "EASY") return "Easy";
  if (d === "MEDIUM") return "Medium";
  if (d === "HARD") return "Hard";
  return "Unspecified";
}

export function StatisticsPanel({ evaluationReport, trace, slotDecisions, questions }: StatisticsPanelProps) {
  // Constraint failures chart
  const constraintData = useMemo(() => {
    if (!trace?.stats.constraintFailuresByType) return [];
    return Object.entries(trace.stats.constraintFailuresByType)
      .map(([key, count]) => ({ label: key, count, max: Math.max(1, ...Object.values(trace.stats.constraintFailuresByType)) }))
      .sort((a, b) => b.count - a.count);
  }, [trace]);

  // Score distribution across all candidates
  const scoreDistribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    for (const decision of slotDecisions) {
      for (const candidate of decision.candidates) {
        const score = candidate.score;
        if (score < 20) buckets[0]++;
        else if (score < 40) buckets[1]++;
        else if (score < 60) buckets[2]++;
        else if (score < 80) buckets[3]++;
        else buckets[4]++;
      }
    }
    const max = Math.max(1, ...buckets);
    return buckets.map((count, i) => ({
      range: `${i * 20}-${i * 20 + 19}`,
      count,
      pct: Math.round((count / Math.max(1, slotDecisions.reduce((s, d) => s + d.candidates.length, 0))) * 100),
      max,
    }));
  }, [slotDecisions]);

  // Bloom distribution from selected questions
  const bloomDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of questions) {
      counts[q.rbtLevel] = (counts[q.rbtLevel] ?? 0) + 1;
    }
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts)
      .map(([level, count]) => ({ level: getBloomLevel(level), code: level, count, max }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [questions]);

  // Difficulty distribution
  const difficultyDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of questions) {
      const key = q.difficultyLevel ?? "UNSPECIFIED";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts)
      .map(([level, count]) => ({ label: getDifficultyLabel(level === "UNSPECIFIED" ? null : level), count, max }))
      .sort((a, b) => b.count - a.count);
  }, [questions]);

  return (
    <div className="space-y-8">
      {/* Constraint Failures */}
      <section>
        <h3 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Constraint Failures by Type</h3>
        {constraintData.length > 0 ? (
          <div className="space-y-3">
            {constraintData.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{item.label}</span>
                  <span className="font-medium tabular-nums">{item.count}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div
                    className="h-full rounded-full bg-[var(--danger)] transition-all"
                    style={{ width: `${(item.count / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
            No constraint failure data available.
          </div>
        )}
      </section>

      {/* Score Distribution */}
      <section>
        <h3 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Candidate Score Distribution</h3>
        {scoreDistribution.some((b) => b.count > 0) ? (
          <div className="space-y-3">
            {scoreDistribution.map((bucket) => (
              <div key={bucket.range} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{bucket.range}</span>
                  <span className="font-medium tabular-nums">{bucket.count} ({bucket.pct}%)</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${bucket.pct}%`,
                      background: `linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
            No candidate score distribution data available.
          </div>
        )}
      </section>

      {/* Bloom Level Distribution */}
      <section>
        <h3 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Bloom&apos;s Taxonomy Distribution</h3>
        {bloomDist.length > 0 ? (
          <div className="space-y-3">
            {bloomDist.map((item) => (
              <DistributionBar
                key={item.code}
                label={`${item.level} (${item.code})`}
                value={item.count}
                max={item.max}
                color="#3b82f6"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
            No Bloom level data available.
          </div>
        )}
      </section>

      {/* Difficulty Distribution */}
      <section>
        <h3 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Difficulty Distribution</h3>
        {difficultyDist.length > 0 ? (
          <div className="space-y-3">
            {difficultyDist.map((item) => (
              <DistributionBar
                key={item.label}
                label={item.label}
                value={item.count}
                max={item.max}
                color={item.label === "Hard" ? "#ef4444" : item.label === "Medium" ? "#f59e0b" : "#22c55e"}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
            No difficulty distribution data available.
          </div>
        )}
      </section>
    </div>
  );
}
