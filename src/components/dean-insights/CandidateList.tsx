"use client";

import { useState } from "react";
import type { SlotDecision, InsightQuestion } from "./types";

type CandidateListProps = {
  slotDecisions: SlotDecision[];
  questions: InsightQuestion[];
};

function questionForId(questions: InsightQuestion[], id: string): InsightQuestion | undefined {
  return questions.find((q) => q.id === id);
}

export function CandidateList({ slotDecisions, questions }: CandidateListProps) {
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});

  if (!slotDecisions || slotDecisions.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-tertiary)]">
        No slot-level candidate data available for this paper. Generation trace contains only aggregate evaluation data.
      </div>
    );
  }

  const toggleSlot = (key: string) => {
    setExpandedSlots((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      {slotDecisions.map((decision, idx) => {
        const key = `M${decision.moduleNumber}-${decision.marks}m`;
        const selectedQuestion = questionForId(questions, decision.selectedQuestionId);
        const expanded = expandedSlots[key] ?? false;
        const sorted = [...decision.candidates].sort((a, b) => b.score - a.score);

        return (
          <div key={key} className="overflow-hidden rounded-xl border border-[var(--border)]">
            <button
              type="button"
              className="flex w-full items-center justify-between bg-[var(--surface-hover)] px-4 py-3 text-left text-sm font-medium"
              onClick={() => toggleSlot(key)}
            >
              <span>Slot M{decision.moduleNumber} · {decision.marks} marks</span>
              <span className="text-[var(--text-tertiary)]">{expanded ? "▲" : "▼"}</span>
            </button>

            {expanded && (
              <div className="divide-y divide-[var(--border)]">
                {sorted.map((candidate) => {
                  const question = questionForId(questions, candidate.questionId);
                  const isSelected = candidate.selected;
                  const scoreDiff = sorted.length > 1 && !isSelected && sorted[0]
                    ? Math.round((sorted[0].score - candidate.score) * 100) / 100
                    : null;

                  return (
                    <div key={candidate.questionId} className={`p-4 ${isSelected ? "bg-[var(--success-bg)]" : ""}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <span className="inline-flex items-center rounded-full bg-[var(--success)] px-2 py-0.5 text-xs font-medium text-white">
                                Selected
                              </span>
                            )}
                            {scoreDiff != null && (
                              <span className="text-xs text-[var(--danger)]">
                                -{scoreDiff} pts vs winner
                              </span>
                            )}
                          </div>
                          <div className="mt-2">
                            {question ? (
                              <p className="text-sm leading-6 line-clamp-3">{question.questionText}</p>
                            ) : (
                              <p className="text-sm text-[var(--text-tertiary)]">Question ID: {candidate.questionId}</p>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                            Score: <span className="font-medium">{Math.round(candidate.score)}/100</span>
                            {question && ` · M${question.moduleNumber} · ${question.marks}m · ${question.rbtLevel}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-bold tabular-nums">{Math.round(candidate.score)}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">/100</div>
                        </div>
                      </div>

                      {candidate.rejectionReasons.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-[var(--text-tertiary)]">Rejection Reasons:</p>
                          <ul className="space-y-0.5">
                            {candidate.rejectionReasons.map((reason, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--danger)]" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
