"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

type RevisionSnapshot = {
  id: string;
  revisionNumber: number;
  snapshotModule: number;
  snapshotMarks: number;
  snapshotCo: string;
  snapshotRbt: string;
  snapshotDifficulty: string | null;
  snapshotTeachingIndex: string | null;
  snapshotQuestionText: string;
  changedBy: { name: string } | null;
  createdAt: string;
};

function DiffRow({ label, oldVal, newVal }: { label: string; oldVal: string | number | null; newVal: string | number | null }) {
  const changed = String(oldVal ?? "—") !== String(newVal ?? "—");
  return (
    <div className={`grid grid-cols-[140px_1fr_24px_1fr] gap-2 rounded-md px-3 py-2 text-sm ${changed ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
      <span className="font-medium text-[var(--text-tertiary)]">{label}</span>
      <span className={`font-mono ${changed ? "text-red-600 line-through" : ""}`}>{oldVal ?? "—"}</span>
      <ChevronRight className={`h-4 w-4 self-center ${changed ? "text-amber-500" : "text-[var(--text-tertiary)]"}`} />
      <span className={`font-mono ${changed ? "font-semibold text-green-600" : ""}`}>{newVal ?? "—"}</span>
    </div>
  );
}

export function RevisionDiff({ revisions }: { revisions: RevisionSnapshot[] }) {
  const sorted = [...revisions].sort((a, b) => a.revisionNumber - b.revisionNumber);
  const [oldIdx, setOldIdx] = useState(Math.max(0, sorted.length - 2));
  const [newIdx, setNewIdx] = useState(sorted.length - 1);

  if (sorted.length < 2) return null;

  const oldRev = sorted[oldIdx];
  const newRev = sorted[newIdx];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Revision Comparison</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-[var(--text-tertiary)]">Old:</span>
              <Select value={String(oldIdx)} onChange={(e) => setOldIdx(Number(e.target.value))} className="w-28">
                {sorted.map((r, i) => (
                  <option key={r.id} value={i} disabled={i === newIdx}>v{r.revisionNumber} ({new Date(r.createdAt).toLocaleDateString()})</option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[var(--text-tertiary)]">New:</span>
              <Select value={String(newIdx)} onChange={(e) => setNewIdx(Number(e.target.value))} className="w-28">
                {sorted.map((r, i) => (
                  <option key={r.id} value={i} disabled={i === oldIdx}>v{r.revisionNumber} ({new Date(r.createdAt).toLocaleDateString()})</option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <DiffRow label="Module" oldVal={oldRev.snapshotModule} newVal={newRev.snapshotModule} />
        <DiffRow label="Marks" oldVal={oldRev.snapshotMarks} newVal={newRev.snapshotMarks} />
        <DiffRow label="CO" oldVal={oldRev.snapshotCo} newVal={newRev.snapshotCo} />
        <DiffRow label="RBT Level" oldVal={oldRev.snapshotRbt} newVal={newRev.snapshotRbt} />
        <DiffRow label="Difficulty" oldVal={oldRev.snapshotDifficulty} newVal={newRev.snapshotDifficulty} />
        <DiffRow label="Teaching Index" oldVal={oldRev.snapshotTeachingIndex} newVal={newRev.snapshotTeachingIndex} />

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-[var(--text-tertiary)]">Question Text</p>
          {oldRev.snapshotQuestionText !== newRev.snapshotQuestionText ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:bg-red-950/20">
                <p className="mb-1 text-xs font-semibold text-red-600">Removed</p>
                <p className="whitespace-pre-wrap text-red-700">{oldRev.snapshotQuestionText}</p>
              </div>
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:bg-green-950/20">
                <p className="mb-1 text-xs font-semibold text-green-600">Added</p>
                <p className="whitespace-pre-wrap text-green-700">{newRev.snapshotQuestionText}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
              <p className="whitespace-pre-wrap">{newRev.snapshotQuestionText}</p>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          Changed by {newRev.changedBy?.name ?? "Unknown"} on {new Date(newRev.createdAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
