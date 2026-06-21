"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { questionStatusLabels, questionBankPhaseLabels, difficultyLabels } from "@/lib/constants";

export type SlotQuestion = {
  id: string;
  questionText: string;
  status: string;
  coMapping: string;
  rbtLevel: string;
  difficultyLevel: string | null;
  creator: { id: string; name: string } | null;
};

export type SlotItem = {
  slotNumber: number;
  moduleNumber: number;
  marks: number;
  isLocked: boolean;
  assignedQuestion: SlotQuestion | null;
};

const MODULE_LABELS: Record<number, string> = {
  1: "Module 1", 2: "Module 2", 3: "Module 3",
  4: "Module 4", 5: "Module 5", 6: "Module 6",
};

const PHASE_FLOW = ["DRAFTING", "MODERATION", "APPROVAL", "COMPLETE"];

function slotStatusClass(status: string | null): string {
  if (!status) return "border-dashed border-[var(--border)] bg-white";
  switch (status) {
    case "DRAFT": return "border-blue-400 bg-blue-50";
    case "PENDING": return "border-amber-400 bg-amber-50";
    case "APPROVED": return "border-green-500 bg-green-50";
    case "REJECTED": return "border-red-400 bg-red-50";
    case "REVISION_REQUESTED": return "border-purple-400 bg-purple-50";
    case "REVISION_SUBMITTED": return "border-orange-400 bg-orange-50";
    default: return "border-[var(--border)] bg-white";
  }
}

function SlotCell({ slot, isSelected, onClick }: {
  slot: SlotItem; isSelected: boolean; onClick: () => void;
}) {
  const status = slot.assignedQuestion?.status ?? null;
  const q = slot.assignedQuestion?.questionText?.slice(0, 60) ?? "Empty";
  const ariaLabel = `Slot ${slot.slotNumber}, Module ${slot.moduleNumber}, ${slot.marks} marks, ${status ?? "empty"}`;
  return (
    <div role="gridcell" tabIndex={0} aria-label={ariaLabel}
      title={`Slot ${slot.slotNumber} · M${slot.moduleNumber} · ${slot.marks}mk · ${status ?? "empty"} · ${q}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`relative flex h-9 w-9 items-center justify-center rounded border text-xs font-medium transition-colors ${slotStatusClass(status)} ${isSelected ? "ring-2 ring-[var(--foreground)]" : "hover:opacity-80"} ${slot.isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={status ? "" : "text-[var(--text-tertiary)]"}>{slot.slotNumber}</span>
    </div>
  );
}

export function SlotDetailPanel({ slot }: { slot: SlotItem }) {
  const q = slot.assignedQuestion;
  if (!q) {
    return (
      <Card>
        <CardHeader><CardTitle>Slot {slot.slotNumber} · Module {slot.moduleNumber} · {slot.marks} Marks</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-[var(--text-tertiary)]">No question assigned to this slot.</p></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Slot {slot.slotNumber} · Module {slot.moduleNumber} · {slot.marks} Marks</CardTitle>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">{q.coMapping} · {q.rbtLevel}{q.difficultyLevel ? ` · ${difficultyLabels[q.difficultyLevel as keyof typeof difficultyLabels] ?? q.difficultyLevel}` : ""}</p>
          </div>
          <Badge>{questionStatusLabels[q.status as keyof typeof questionStatusLabels] ?? q.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-[var(--surface-hover)] p-4 text-sm whitespace-pre-wrap">{q.questionText}</div>
        <div className="flex items-center gap-3 text-sm text-[var(--text-tertiary)]">
          <span>Contributor: {q.creator?.name ?? "Unknown"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function SlotGrid({ slots, modules, marksOptions, selectedSlotId, onSlotClick, title }: {
  slots: SlotItem[]; modules: number[]; marksOptions: number[]; selectedSlotId: string | null; onSlotClick: (slot: SlotItem) => void; title?: string;
}) {
  const grid = useMemo(() => {
    const map = new Map<string, SlotItem[]>();
    for (const slot of slots) {
      const key = `${slot.moduleNumber}-${slot.marks}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return map;
  }, [slots]);

  const gridRows = useMemo(() => {
    const rows: SlotItem[][] = [];
    for (const mn of modules) {
      for (const m of marksOptions) {
        const key = `${mn}-${m}`;
        const group = grid.get(key) ?? [];
        if (group.length > 0) rows.push(group.sort((a, b) => a.slotNumber - b.slotNumber));
      }
    }
    return rows;
  }, [grid, modules, marksOptions]);

  function findSlotPosition(slotKey: string): { row: number; col: number } | null {
    for (let r = 0; r < gridRows.length; r++) {
      for (let c = 0; c < gridRows[r].length; c++) {
        const s = gridRows[r][c];
        if (`${s.moduleNumber}-${s.marks}-${s.slotNumber}` === slotKey) return { row: r, col: c };
      }
    }
    return null;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!selectedSlotId) return;
    const pos = findSlotPosition(selectedSlotId);
    if (!pos) return;
    let { row, col } = pos;
    switch (e.key) {
      case "ArrowRight": col = Math.min(col + 1, gridRows[row].length - 1); break;
      case "ArrowLeft": col = Math.max(col - 1, 0); break;
      case "ArrowDown": row = Math.min(row + 1, gridRows.length - 1); col = Math.min(col, gridRows[row].length - 1); break;
      case "ArrowUp": row = Math.max(row - 1, 0); col = Math.min(col, gridRows[row].length - 1); break;
      default: return;
    }
    e.preventDefault();
    onSlotClick(gridRows[row][col]);
  }

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title ?? "Slot Grid"}</CardTitle></CardHeader>
      <CardContent>
        <div role="grid" aria-label="Question slot grid" onKeyDown={handleKeyDown} className="space-y-6 outline-none">
          {modules.map((moduleNumber) => (
            <div key={moduleNumber} role="row">
              <h3 className="text-sm font-semibold mb-2">{MODULE_LABELS[moduleNumber] ?? `Module ${moduleNumber}`}</h3>
              <div className="space-y-2">
                {marksOptions.map((marks) => {
                  const key = `${moduleNumber}-${marks}`;
                  const group = grid.get(key) ?? [];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs text-[var(--text-tertiary)]">{marks} marks</span>
                      <div className="flex gap-1" role="row">
                        {group.sort((a, b) => a.slotNumber - b.slotNumber).map((slot) => (
                          <SlotCell key={slot.slotNumber} slot={slot}
                            isSelected={selectedSlotId === `${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`}
                            onClick={() => onSlotClick(slot)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CoverageStats({ slots, totalSlots }: { slots: SlotItem[]; totalSlots: number }) {
  const filled = slots.filter((s) => s.assignedQuestion).length;
  const fillPct = totalSlots > 0 ? Math.round((filled / totalSlots) * 100) : 0;

  const difficulties = useMemo(() => {
    const d = slots.map((s) => s.assignedQuestion?.difficultyLevel).filter(Boolean);
    return {
      easy: d.filter((x) => x === "EASY").length,
      medium: d.filter((x) => x === "MEDIUM").length,
      hard: d.filter((x) => x === "HARD").length,
    };
  }, [slots]);

  const rbtLevels = useMemo(() => {
    const r = slots.map((s) => s.assignedQuestion?.rbtLevel).filter(Boolean);
    return { L1: r.filter((x) => x === "L1").length, L2: r.filter((x) => x === "L2").length, L3: r.filter((x) => x === "L3").length, L4: r.filter((x) => x === "L4").length, L5: r.filter((x) => x === "L5").length, L6: r.filter((x) => x === "L6").length };
  }, [slots]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Fill Rate</p>
        <div className="mt-2">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold">{fillPct}%</span>
            <span className="text-xs text-[var(--text-tertiary)]">({filled}/{totalSlots})</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div className={`h-full rounded-full ${fillPct >= 100 ? "bg-green-500" : fillPct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${fillPct}%` }} />
          </div>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Difficulty</p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 text-xs"><span className="w-10 text-green-600 font-medium">{difficulties.easy}</span><span className="text-[var(--text-tertiary)]">Easy</span></div>
          <div className="flex items-center gap-2 text-xs"><span className="w-10 text-amber-600 font-medium">{difficulties.medium}</span><span className="text-[var(--text-tertiary)]">Medium</span></div>
          <div className="flex items-center gap-2 text-xs"><span className="w-10 text-red-600 font-medium">{difficulties.hard}</span><span className="text-[var(--text-tertiary)]">Hard</span></div>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-3 col-span-2">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">RBT Levels</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["L1", "L2", "L3", "L4", "L5", "L6"] as const).map((level) => {
            const count = rbtLevels[level] ?? 0;
            return (
              <div key={level} className={`rounded px-2 py-0.5 text-xs ${count > 0 ? "bg-blue-50 text-blue-700 font-medium" : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"}`}>
                {level}: {count}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
