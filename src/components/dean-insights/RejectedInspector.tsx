"use client";

import { useMemo, useState } from "react";
import type { SlotDecision, InsightQuestion } from "./types";

type RejectedInspectorProps = {
  slotDecisions: SlotDecision[];
  questions: InsightQuestion[];
};

export function RejectedInspector({ slotDecisions, questions }: RejectedInspectorProps) {
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rejectedItems = useMemo(() => {
    const items: Array<{
      slotKey: string;
      moduleNumber: number;
      marks: number;
      questionId: string;
      questionText: string;
      score: number;
      rejectionReasons: string[];
      winnerScore: number;
      scoreDiff: number;
      rbtLevel: string;
      difficultyLevel: string | null;
    }> = [];

    for (const decision of slotDecisions) {
      const winner = decision.candidates.find((c) => c.selected);
      const winnerScore = winner?.score ?? 0;
      const winnerQuestion = winner ? questions.find((q) => q.id === winner.questionId) : null;

      for (const candidate of decision.candidates) {
        if (candidate.selected) continue;
        const question = questions.find((q) => q.id === candidate.questionId);
        const questionText = question?.questionText ?? `Question ID: ${candidate.questionId}`;

        items.push({
          slotKey: `M${decision.moduleNumber}·${decision.marks}m`,
          moduleNumber: decision.moduleNumber,
          marks: decision.marks,
          questionId: candidate.questionId,
          questionText,
          score: candidate.score,
          rejectionReasons: candidate.rejectionReasons,
          winnerScore,
          scoreDiff: Math.round((winnerScore - candidate.score) * 100) / 100,
          rbtLevel: question?.rbtLevel ?? "N/A",
          difficultyLevel: question?.difficultyLevel ?? null,
        });
      }
    }

    // Filter
    const filtered = items.filter((item) => {
      if (filterModule !== "all" && item.moduleNumber !== Number(filterModule)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.questionText.toLowerCase().includes(q) ||
          item.slotKey.toLowerCase().includes(q) ||
          item.rejectionReasons.some((r) => r.toLowerCase().includes(q))
        );
      }
      return true;
    });

    // Sort by score desc
    filtered.sort((a, b) => b.score - a.score);
    return filtered;
  }, [slotDecisions, questions, search, filterModule]);

  const modules = useMemo(() => {
    const s = new Set(slotDecisions.map((d) => d.moduleNumber));
    return [...s].sort((a, b) => a - b);
  }, [slotDecisions]);

  if (rejectedItems.length === 0 && !search && filterModule === "all") {
    const hasTraceData = slotDecisions.some((d) => d.candidates.length > 1);
    if (!hasTraceData) {
      return (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-tertiary)]">
          No rejected candidate data available. The current generation trace does not include per-candidate rejection details for individual slots.
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search rejected questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          <option value="all">All Modules</option>
          {modules.map((m) => (
            <option key={m} value={String(m)}>Module {m}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        {rejectedItems.length} rejected candidate{rejectedItems.length !== 1 ? "s" : ""} found
      </p>

      <div className="space-y-3">
        {rejectedItems.map((item) => {
          const isExpanded = expandedId === item.questionId;
          return (
            <div key={item.questionId} className="overflow-hidden rounded-xl border border-[var(--border)]">
              <button
                type="button"
                className="flex w-full items-start gap-4 p-4 text-left hover:bg-[var(--surface-hover)] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : item.questionId)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-bg)] text-sm font-bold text-[var(--danger)]">
                  {Math.round(item.score)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-6 line-clamp-2">{item.questionText}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
                      Rejected
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">{item.slotKey}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">· {item.rbtLevel}</span>
                    {item.difficultyLevel && (
                      <span className="text-xs text-[var(--text-tertiary)]">· {item.difficultyLevel}</span>
                    )}
                    <span className="text-xs font-medium text-[var(--danger)]">
                      -{item.scoreDiff} pts vs winner
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
                  {item.rejectionReasons.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Rejection Reasons</p>
                      <ul className="mt-2 space-y-1">
                        {item.rejectionReasons.map((reason, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--danger)]" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-tertiary)] italic">No specific rejection reasons recorded for this candidate.</p>
                  )}

                  <div className="rounded-lg bg-[var(--surface-hover)] p-3">
                    <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-[0.1em]">Score Impact</p>
                    <p className="mt-1 text-sm">
                      Candidate scored <span className="font-semibold">{Math.round(item.score)}/100</span>.
                      The selected question scored <span className="font-semibold">{Math.round(item.winnerScore)}/100</span>.
                      Difference: <span className="font-semibold text-[var(--danger)]">-{item.scoreDiff} pts</span>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rejectedItems.length === 0 && (search || filterModule !== "all") && (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-tertiary)]">
          No rejected candidates match your search criteria.
        </div>
      )}
    </div>
  );
}
