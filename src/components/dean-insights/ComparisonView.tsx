"use client";

import { useState, useMemo } from "react";
import type { SlotDecision, InsightQuestion } from "./types";

type ComparisonViewProps = {
  slotDecisions: SlotDecision[];
  questions: InsightQuestion[];
};

type ScoreDiff = {
  category: string;
  thisScore: number;
  otherScore: number;
  diff: number;
};

export function ComparisonView({ slotDecisions, questions }: ComparisonViewProps) {
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [candidateA, setCandidateA] = useState<string>("");
  const [candidateB, setCandidateB] = useState<string>("");

  const decisionMap = useMemo(() => {
    const map = new Map<string, SlotDecision>();
    for (const d of slotDecisions) {
      map.set(`M${d.moduleNumber}-${d.marks}m`, d);
    }
    return map;
  }, [slotDecisions]);

  const availableSlots = useMemo(() => {
    return slotDecisions.filter((d) => d.candidates.length >= 2).map((d) => ({
      key: `M${d.moduleNumber}-${d.marks}m`,
      label: `M${d.moduleNumber} · ${d.marks}m`,
    }));
  }, [slotDecisions]);

  const decision = decisionMap.get(selectedSlot);
  const candidates = decision?.candidates ?? [];

  const candAObj = candidates.find((c) => c.questionId === candidateA);
  const candBObj = candidates.find((c) => c.questionId === candidateB);

  const scoreDiffs: ScoreDiff[] = useMemo(() => {
    if (!candAObj || !candBObj) return [];
    const aCats = candAObj.report.categories;
    const bCats = candBObj.report.categories;
    return aCats.map((aCat) => {
      const bCat = bCats.find((b) => b.label === aCat.label);
      const otherScore = bCat?.earned ?? 0;
      return {
        category: aCat.label,
        thisScore: Math.round(aCat.earned * 100) / 100,
        otherScore: Math.round(otherScore * 100) / 100,
        diff: Math.round((aCat.earned - otherScore) * 100) / 100,
      };
    });
  }, [candAObj, candBObj]);

  if (availableSlots.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-tertiary)]">
        No slots with multiple candidates available for comparison. Generation trace data does not include per-candidate details for individual slots.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-[0.1em] mb-1.5">Select Slot</label>
          <select
            value={selectedSlot}
            onChange={(e) => {
              setSelectedSlot(e.target.value);
              setCandidateA("");
              setCandidateB("");
            }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="">Choose a slot...</option>
            {availableSlots.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-[0.1em] mb-1.5">Candidate A</label>
          <select
            value={candidateA}
            onChange={(e) => setCandidateA(e.target.value)}
            disabled={!selectedSlot}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
          >
            <option value="">Select...</option>
            {candidates.map((c) => {
              const q = questions.find((qq) => qq.id === c.questionId);
              return (
                <option key={c.questionId} value={c.questionId}>
                  {q?.questionText.slice(0, 60) ?? c.questionId}... ({Math.round(c.score)} pts)
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-[0.1em] mb-1.5">Candidate B</label>
          <select
            value={candidateB}
            onChange={(e) => setCandidateB(e.target.value)}
            disabled={!selectedSlot}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
          >
            <option value="">Select...</option>
            {candidates.filter((c) => c.questionId !== candidateA).map((c) => {
              const q = questions.find((qq) => qq.id === c.questionId);
              return (
                <option key={c.questionId} value={c.questionId}>
                  {q?.questionText.slice(0, 60) ?? c.questionId}... ({Math.round(c.score)} pts)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {candAObj && candBObj && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <ComparisonCard
              title="Candidate A"
              isSelected={candAObj.selected}
              candidate={candAObj}
              question={questions.find((q) => q.id === candAObj.questionId)}
            />
            <ComparisonCard
              title="Candidate B"
              isSelected={candBObj.selected}
              candidate={candBObj}
              question={questions.find((q) => q.id === candBObj.questionId)}
            />
          </div>

          <div className="rounded-xl border border-[var(--border)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="text-sm font-medium">Score Comparison</p>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {scoreDiffs.map((diff) => (
                <div key={diff.category} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-[var(--text-secondary)]">{diff.category}</span>
                  <div className="flex items-center gap-3 text-sm tabular-nums">
                    <span className={diff.diff > 0 ? "text-[var(--success)]" : diff.diff < 0 ? "text-[var(--danger)]" : ""}>
                      {Math.round(diff.thisScore * 100) / 100}
                    </span>
                    <span className="text-[var(--text-tertiary)]">vs</span>
                    <span className={diff.diff < 0 ? "text-[var(--success)]" : diff.diff > 0 ? "text-[var(--danger)]" : ""}>
                      {Math.round(diff.otherScore * 100) / 100}
                    </span>
                    <span
                      className={`ml-2 text-xs font-medium ${
                        diff.diff > 0 ? "text-[var(--success)]" : diff.diff < 0 ? "text-[var(--danger)]" : "text-[var(--text-tertiary)]"
                      }`}
                    >
                      {diff.diff > 0 ? `+${diff.diff}` : diff.diff === 0 ? "0" : String(diff.diff)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between bg-[var(--surface-hover)] px-4 py-3">
                <span className="text-sm font-medium">Overall</span>
                <div className="flex items-center gap-3 text-sm tabular-nums font-semibold">
                  <span>{Math.round(candAObj.score)}</span>
                  <span className="text-[var(--text-tertiary)] font-normal">vs</span>
                  <span>{Math.round(candBObj.score)}</span>
                  <span
                    className={`ml-2 text-xs font-bold ${
                      candAObj.score > candBObj.score
                        ? "text-[var(--success)]"
                        : candAObj.score < candBObj.score
                        ? "text-[var(--danger)]"
                        : "text-[var(--text-tertiary)]"
                    }`}
                  >
                    {candAObj.score > candBObj.score ? `+${Math.round((candAObj.score - candBObj.score) * 100) / 100}` : candAObj.score < candBObj.score ? `-${Math.round((candBObj.score - candAObj.score) * 100) / 100}` : "0"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ComparisonCard({
  title,
  isSelected,
  candidate,
  question,
}: {
  title: string;
  isSelected: boolean;
  candidate: { questionId: string; score: number; rejectionReasons: string[] };
  question?: InsightQuestion;
}) {
  return (
    <div className={`rounded-xl border p-4 ${isSelected ? "border-[var(--success)] bg-[var(--success-bg)]" : "border-[var(--border)]"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {isSelected && (
          <span className="inline-flex items-center rounded-full bg-[var(--success)] px-2 py-0.5 text-xs font-medium text-white">
            Selected
          </span>
        )}
      </div>
      {question && (
        <p className="mt-2 text-sm leading-6 line-clamp-3">{question.questionText}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
        <span className="font-semibold text-[var(--text-primary)]">{Math.round(candidate.score)}/100</span>
        {question && (
          <>
            <span>M{question.moduleNumber} · {question.marks}m</span>
            <span>{question.rbtLevel}</span>
          </>
        )}
      </div>
      {candidate.rejectionReasons.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Rejection Reasons:</p>
          <ul className="space-y-0.5">
            {candidate.rejectionReasons.map((reason, i) => (
              <li key={i} className="text-xs text-[var(--text-secondary)]">· {reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
