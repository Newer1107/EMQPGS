"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { questionBankPhaseLabels, recordStatusLabels, questionStatusLabels, difficultyLabels } from "@/lib/constants";
import { BankActionsPanel } from "@/components/forms/bank-actions-panel";
import { WorkflowTimeline } from "@/components/forms/workflow-timeline";
import { NextStepGuidance } from "@/components/forms/next-step-guidance";
import { apiFetch } from "@/lib/client-fetch";
import { EntityStatusBanner } from "@/components/shared/entity-status-banner";
import { InlineAssignPanel } from "@/components/shared/inline-assign-panel";

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

export type AiReportItem = {
  id: string;
  status: string;
  modelName: string;
  summary: string | null;
  failureReason: string | null;
  generatedAt: string | null;
};

export type GeneratedPaperItem = {
  id: string;
  variant: string;
  status: string;
  coverageScore: number | null;
  difficultyScore: number | null;
  qualityScore: number | null;
  duplicateRisk: number | null;
  recommendation: string | null;
  questionCount: number;
};

export type DeanReviewItem = {
  id: string;
  regularPaper: string;
  supplementaryPaper: string;
  ktPaper: string;
  reviewedBy: string;
  reviewedAt: string;
};

export type ModeratorInfo = {
  id: string;
  name: string;
  email: string;
};

export type ContributorInfo = {
  id: string;
  name: string;
  email: string;
};

type BankDetailClientProps = {
  bankId: string;
  subjectName: string;
  subjectCode: string;
  batchName: string;
  semesterNumber: number;
  departmentName: string;
  academicYearCode: string;
  examType: string;
  examCycleLabel: string;
  phase: string;
  recordStatus: string;
  userRole: string;
  totalSlots: number;
  totalModules: number;
  marksOptions: number[];
  slotsPerModule: number;
  slots: SlotItem[];
  aiReports: AiReportItem[];
  generatedPapers: GeneratedPaperItem[];
  deanReview: DeanReviewItem | null;
  moderators: ModeratorInfo[];
  contributors: ContributorInfo[];
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

function WorkflowProgressBar({ phase, recordStatus }: { phase: string; recordStatus: string }) {
  const currentIdx = PHASE_FLOW.indexOf(phase);
  const isLocked = recordStatus === "LOCKED";

  return (
    <div className="flex items-center gap-0 w-full">
      {PHASE_FLOW.map((p, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={p} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 text-xs ${isPast ? "text-green-700" : isCurrent ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-tertiary)]"}`}>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                isPast ? "bg-green-500 text-white" : isCurrent ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"
              }`}>
                {isPast ? "✓" : i + 1}
              </div>
              <span className="hidden sm:inline whitespace-nowrap">{questionBankPhaseLabels[p as keyof typeof questionBankPhaseLabels] ?? p}</span>
            </div>
            {i < PHASE_FLOW.length - 1 && (
              <div className={`mx-2 h-px flex-1 ${isPast ? "bg-green-500" : "bg-[var(--border)]"}`} />
            )}
          </div>
        );
      })}
      {isLocked && (
        <>
          <div className="mx-2 h-px flex-1 bg-red-400" />
          <div className="flex items-center gap-2 text-xs text-red-700 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">L</div>
            <span className="hidden sm:inline">Locked</span>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color ?? ""}`}>{value}</p>
    </div>
  );
}

function SlotCell({ slot, isSelected, onClick, onMouseEnter, onMouseLeave }: {
  slot: SlotItem; isSelected: boolean; onClick: () => void;
  onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const status = slot.assignedQuestion?.status ?? null;
  const statusLabel = status ? (questionStatusLabels[status as keyof typeof questionStatusLabels] ?? status) : "empty";
  const ariaLabel = `Slot ${slot.slotNumber}, Module ${slot.moduleNumber}, ${slot.marks} marks, ${statusLabel}`;
  return (
    <div role="gridcell" tabIndex={0} aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`relative flex h-9 w-9 items-center justify-center rounded border text-xs font-medium transition-colors ${slotStatusClass(status)} ${isSelected ? "ring-2 ring-[var(--foreground)]" : "hover:opacity-80"} ${slot.isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={status ? "" : "text-[var(--text-tertiary)]"}>{slot.slotNumber}</span>
    </div>
  );
}

function SlotDetailPanel({ slot }: { slot: SlotItem }) {
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

function ReadinessPanel({ phase, slots, totalSlots }: { phase: string; slots: SlotItem[]; totalSlots: number }) {
  const filledCount = slots.filter((s) => s.assignedQuestion).length;
  const emptyCount = totalSlots - filledCount;
  const pendingCount = slots.filter((s) => s.assignedQuestion?.status === "PENDING" || s.assignedQuestion?.status === "REVISION_SUBMITTED").length;
  const draftCount = slots.filter((s) => s.assignedQuestion?.status === "DRAFT").length;

  const issues: string[] = [];
  const warnings: string[] = [];

  if (phase === "DRAFTING") {
    if (emptyCount > 0) issues.push(`${emptyCount} of ${totalSlots} slots have no question assigned.`);
    if (draftCount > 0) warnings.push(`${draftCount} questions still in draft. Submit before advancing.`);
  }
  if (phase === "MODERATION" || (phase === "DRAFTING" && emptyCount === 0)) {
    if (pendingCount > 0) issues.push(`${pendingCount} questions pending moderation review.`);
  }
  if (phase === "APPROVAL" || (phase === "MODERATION" && emptyCount === 0 && pendingCount === 0)) {
    const cos = new Set(slots.map((s) => s.assignedQuestion?.coMapping).filter(Boolean));
    const rbts = new Set(slots.map((s) => s.assignedQuestion?.rbtLevel).filter(Boolean));
    if (cos.size < 3) warnings.push(`Only ${cos.size} COs covered (minimum 3 recommended).`);
    if (rbts.size < 3) warnings.push(`Only ${rbts.size} RBT levels covered (minimum 3 recommended).`);
  }

  if (phase === "COMPLETE") return null;

  const nextPhaseIdx = PHASE_FLOW.indexOf(phase) + 1;
  const nextPhaseLabel = nextPhaseIdx < PHASE_FLOW.length
    ? (questionBankPhaseLabels[PHASE_FLOW[nextPhaseIdx] as keyof typeof questionBankPhaseLabels] ?? PHASE_FLOW[nextPhaseIdx])
    : "Complete";

  const isReady = issues.length === 0;

  return (
    <div role="alert" className={`rounded-lg border p-4 ${isReady ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
      {isReady ? (
        <div className="flex items-center gap-2 text-green-800">
          <span className="text-lg">✓</span>
          <span className="font-medium">Ready to advance to {nextPhaseLabel}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
            <span className="text-lg">⊘</span>
            <span>Issues blocking advance</span>
          </div>
          {issues.length > 3 ? (
            <details className="text-sm text-red-700">
              <summary className="cursor-pointer font-medium">{issues.length} issue{issues.length > 1 ? "s" : ""}</summary>
              <div className="mt-2 space-y-1">
                {issues.map((issue, i) => (
                  <div key={`issue-${i}`} className="flex items-start gap-2 rounded border border-red-200 bg-red-50/50 p-2 text-sm">
                    <span className="mt-0.5 shrink-0">✗</span><span>{issue}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : (
            <div className="space-y-1">
              {issues.map((issue, i) => (
                <div key={`issue-${i}`} className="flex items-start gap-2 text-sm text-red-700">
                  <span className="mt-0.5 shrink-0">✗</span><span>{issue}</span>
                </div>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <details className="mt-2 text-sm text-amber-700">
              <summary className="cursor-pointer font-medium">{warnings.length} warning{warnings.length > 1 ? "s" : ""}</summary>
              <div className="mt-2 space-y-1">
                {warnings.map((w, i) => (
                  <div key={`warn-${i}`} className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50/50 p-2">
                    <span className="mt-0.5 shrink-0">△</span><span>{w}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function SlotGrid({ slots, modules, marksOptions, selectedSlotId, onSlotClick }: {
  slots: SlotItem[]; modules: number[]; marksOptions: number[]; selectedSlotId: string | null; onSlotClick: (slot: SlotItem) => void;
}) {
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);

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

  const hoveredSlot = useMemo(() => {
    if (!hoveredSlotKey) return null;
    for (const s of slots) {
      if (`${s.moduleNumber}-${s.marks}-${s.slotNumber}` === hoveredSlotKey) return s;
    }
    return null;
  }, [hoveredSlotKey, slots]);

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Slot Grid</CardTitle></CardHeader>
      <CardContent className="relative space-y-6">
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
                            onMouseEnter={() => setHoveredSlotKey(`${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`)}
                            onMouseLeave={() => setHoveredSlotKey(null)}
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
        {hoveredSlot && (
          <div className="mt-2 rounded border bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-sm">
            Slot {hoveredSlot.slotNumber} · Module {hoveredSlot.moduleNumber} · {hoveredSlot.marks} marks · Q: {hoveredSlot.assignedQuestion?.questionText?.slice(0, 40) ?? "Empty"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionListView({ slots, filters, onFilterChange }: {
  slots: SlotItem[];
  filters: { status: string; module: string; difficulty: string; rbtLevel: string };
  onFilterChange: (key: string, value: string) => void;
}) {
  const statuses = useMemo(() => [...new Set(slots.map((s) => s.assignedQuestion?.status).filter(Boolean))], [slots]);
  const modules = useMemo(() => [...new Set(slots.map((s) => s.moduleNumber))].sort(), [slots]);
  const difficulties = useMemo(() => [...new Set(slots.map((s) => s.assignedQuestion?.difficultyLevel).filter(Boolean))], [slots]);
  const rbtLevels = useMemo(() => [...new Set(slots.map((s) => s.assignedQuestion?.rbtLevel).filter(Boolean))], [slots]);

  const filtered = useMemo(() => {
    return slots.filter((s) => {
      if (filters.status && s.assignedQuestion?.status !== filters.status && !(filters.status === "EMPTY" && !s.assignedQuestion)) return false;
      if (filters.module && s.moduleNumber !== Number(filters.module)) return false;
      if (filters.difficulty && s.assignedQuestion?.difficultyLevel !== filters.difficulty) return false;
      if (filters.rbtLevel && s.assignedQuestion?.rbtLevel !== filters.rbtLevel) return false;
      return true;
    });
  }, [slots, filters]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Questions ({filtered.length})</CardTitle>
          <select className="h-8 rounded border border-[var(--border)] bg-white px-2 text-xs" value={filters.status} onChange={(e) => onFilterChange("status", e.target.value)}>
            <option value="">All Status</option>
            <option value="EMPTY">Empty</option>
            {statuses.map((s) => <option key={s} value={s!}>{questionStatusLabels[s as keyof typeof questionStatusLabels] ?? s}</option>)}
          </select>
          <select className="h-8 rounded border border-[var(--border)] bg-white px-2 text-xs" value={filters.module} onChange={(e) => onFilterChange("module", e.target.value)}>
            <option value="">All Modules</option>
            {modules.map((m) => <option key={m} value={m}>Module {m}</option>)}
          </select>
          <select className="h-8 rounded border border-[var(--border)] bg-white px-2 text-xs" value={filters.difficulty} onChange={(e) => onFilterChange("difficulty", e.target.value)}>
            <option value="">All Difficulty</option>
            {difficulties.map((d) => <option key={d} value={d!}>{difficultyLabels[d as keyof typeof difficultyLabels] ?? d}</option>)}
          </select>
          <select className="h-8 rounded border border-[var(--border)] bg-white px-2 text-xs" value={filters.rbtLevel} onChange={(e) => onFilterChange("rbtLevel", e.target.value)}>
            <option value="">All RBT Levels</option>
            {rbtLevels.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[var(--border)]">
          {filtered.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-[var(--text-tertiary)]">No questions match the current filters.</div>
          )}
          {filtered.map((slot) => {
            const q = slot.assignedQuestion;
            return (
              <div key={`${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`} className="flex items-center gap-4 px-6 py-3 hover:bg-[var(--surface-hover)] transition-colors">
                <Badge className="shrink-0 w-16 text-center">M{slot.moduleNumber}</Badge>
                <div className="w-16 shrink-0 text-xs text-[var(--text-tertiary)]">{slot.marks} marks</div>
                <div className="flex-1 min-w-0">
                  {q ? (
                    <p className="text-sm truncate">{q.questionText}</p>
                  ) : (
                    <p className="text-sm text-[var(--text-tertiary)] italic">Empty slot</p>
                  )}
                </div>
                {q && (
                  <div className="flex items-center gap-2 shrink-0">
                    {q.difficultyLevel && <span className="text-xs text-[var(--text-tertiary)]">{difficultyLabels[q.difficultyLevel as keyof typeof difficultyLabels] ?? q.difficultyLevel}</span>}
                    <span className="text-xs text-[var(--text-tertiary)]">{q.rbtLevel}</span>
                    <Badge>{questionStatusLabels[q.status as keyof typeof questionStatusLabels] ?? q.status}</Badge>
                  </div>
                )}
                {q && q.creator && (
                  <span className="text-xs text-[var(--text-tertiary)] shrink-0 w-20 text-right truncate">{q.creator.name}</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageStats({ slots, totalSlots }: { slots: SlotItem[]; totalSlots: number }) {
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
    return {
      l1: r.filter((x) => x === "L1").length,
      l2: r.filter((x) => x === "L2").length,
      l3: r.filter((x) => x === "L3").length,
      L1: r.filter((x) => x === "L1").length,
      L2: r.filter((x) => x === "L2").length,
      L3: r.filter((x) => x === "L3").length,
      L4: r.filter((x) => x === "L4").length,
      L5: r.filter((x) => x === "L5").length,
      L6: r.filter((x) => x === "L6").length,
    };
  }, [slots]);

  const totalQuestions = difficulties.easy + difficulties.medium + difficulties.hard;

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

function AssignPanelWrapper({ bankId, role, title, currentAssignments }: {
  bankId: string;
  role: "CONTRIBUTOR" | "MODERATOR";
  title: string;
  currentAssignments: Array<{ id: string; name: string; email: string }>;
}) {
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!fetched) {
      setFetched(true);
      apiFetch(`/api/users?role=${role}&take=200`)
        .then((r) => r.json())
        .then((result) => { if (result.success) setAvailableUsers(result.data ?? []); })
        .catch(() => {});
    }
  }, [fetched, role]);

  const endpoint = role === "CONTRIBUTOR" ? "contributor" : "moderator";
  const idField = role === "CONTRIBUTOR" ? "contributorId" : "moderatorId";

  const onAssign = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/question-banks/${bankId}/assignments/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [idField]: userId }),
      });
      const result = await res.json();
      return { success: result.success, error: result.error };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const onUnassign = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/question-banks/${bankId}/assignments/${endpoint}?${idField}=${userId}`, { method: "DELETE" });
      const result = await res.json();
      return { success: result.success, error: result.error };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  return (
    <InlineAssignPanel
      bankId={bankId}
      role={role}
      title={title}
      currentAssignments={currentAssignments}
      onAssign={onAssign}
      onUnassign={onUnassign}
      availableUsers={availableUsers}
    />
  );
}

export function BankDetailClient(props: BankDetailClientProps) {
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState({ status: "", module: "", difficulty: "", rbtLevel: "" });

  const modules = useMemo(() => { const arr: number[] = []; for (let i = 1; i <= props.totalModules; i++) arr.push(i); return arr; }, [props.totalModules]);

  const filledCount = props.slots.filter((s) => s.assignedQuestion).length;
  const approvedCount = props.slots.filter((s) => s.assignedQuestion?.status === "APPROVED").length;
  const pendingCount = props.slots.filter((s) => s.assignedQuestion?.status === "PENDING" || s.assignedQuestion?.status === "REVISION_SUBMITTED").length;
  const rejectedCount = props.slots.filter((s) => s.assignedQuestion?.status === "REJECTED" || s.assignedQuestion?.status === "REVISION_REQUESTED").length;
  const emptyCount = props.totalSlots - filledCount;

  const stats = { total: props.totalSlots, filled: filledCount, empty: emptyCount, approved: approvedCount, pending: pendingCount, rejected: rejectedCount };

  function handleSlotClick(slot: SlotItem) {
    const key = `${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`;
    const selectedKey = selectedSlot ? `${selectedSlot.moduleNumber}-${selectedSlot.marks}-${selectedSlot.slotNumber}` : null;
    setSelectedSlot(selectedKey === key ? null : slot);
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/dashboard/coordinator" className="hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/coordinator/question-banks" className="hover:text-[var(--text-primary)] transition-colors">Question Banks</Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{props.subjectCode}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{props.subjectName}</h1>
            <Badge className="text-xs">{props.subjectCode}</Badge>
            <Badge variant={props.recordStatus === "LOCKED" ? "danger" : props.recordStatus === "ACTIVE" ? "success" : "default"}>
              {recordStatusLabels[props.recordStatus as keyof typeof recordStatusLabels] ?? props.recordStatus}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {props.examType} · {props.batchName} · Sem {props.semesterNumber} · {props.academicYearCode} · {props.departmentName}
          </p>
        </div>
      </div>

      <WorkflowProgressBar phase={props.phase} recordStatus={props.recordStatus} />

      <div className="grid gap-4 sm:grid-cols-6">
        {[
          { label: "Total", value: stats.total },
          { label: "Filled", value: stats.filled, color: "text-green-600" },
          { label: "Empty", value: stats.empty, color: stats.empty > 0 ? "text-red-600" : "" },
          { label: "Approved", value: stats.approved, color: "text-green-600" },
          { label: "Pending", value: stats.pending, color: stats.pending > 0 ? "text-amber-600" : "" },
          { label: "Rejected", value: stats.rejected, color: stats.rejected > 0 ? "text-red-600" : "" },
        ].map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} color={item.color} />
        ))}
      </div>

      <ReadinessPanel phase={props.phase} slots={props.slots} totalSlots={props.totalSlots} />

      <EntityStatusBanner items={(() => {
        if (props.recordStatus === "LOCKED") return [{ id: "locked", title: "Bank Locked", description: "This question bank is locked. No changes can be made.", severity: "critical" as const }];
        if (props.phase === "DRAFTING") return [{ id: "drafting", title: "Drafting in Progress", description: `${emptyCount} of ${props.totalSlots} slots still empty.`, severity: "info" as const }];
        if (props.phase === "MODERATION") return [{ id: "moderation", title: "Under Moderation", description: "Waiting for moderator review.", severity: "warning" as const }];
        if (props.phase === "APPROVAL") return [{ id: "approval", title: "Awaiting Decision", description: "Awaiting coordinator decision.", severity: "info" as const }];
        if (props.phase === "COMPLETE") return [{ id: "complete", title: "Bank Complete", description: "All slots filled and approved.", severity: "success" as const }];
        return [];
      })()} />

      <div className="flex items-center gap-2 border-b pb-2">
        <button onClick={() => setViewMode("grid")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[3px] transition-colors ${viewMode === "grid" ? "border-[var(--foreground)]" : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`}>Slot Grid</button>
        <button onClick={() => setViewMode("list")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[3px] transition-colors ${viewMode === "list" ? "border-[var(--foreground)]" : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`}>Question List</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {viewMode === "grid" ? (
            <>
              <SlotGrid slots={props.slots} modules={modules} marksOptions={props.marksOptions} selectedSlotId={selectedSlot ? `${selectedSlot.moduleNumber}-${selectedSlot.marks}-${selectedSlot.slotNumber}` : null} onSlotClick={handleSlotClick} />
              {selectedSlot && <SlotDetailPanel slot={selectedSlot} />}
            </>
          ) : (
            <QuestionListView slots={props.slots} filters={filters} onFilterChange={handleFilterChange} />
          )}

          {props.phase === "APPROVAL" && props.aiReports.length > 0 && (
            <Card>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 pt-4 pb-3">
                  <CardTitle className="text-sm font-semibold">AI Report</CardTitle>
                  <span className="text-xs text-[var(--text-tertiary)] group-open:hidden">Show</span>
                  <span className="text-xs text-[var(--text-tertiary)] hidden group-open:inline">Hide</span>
                </summary>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border p-3"><p className="text-xs text-[var(--text-tertiary)]">Status</p><p className="font-medium">{props.aiReports[0].status}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-[var(--text-tertiary)]">Model</p><p className="font-medium">{props.aiReports[0].modelName}</p></div>
                    {props.aiReports[0].generatedAt && <div className="rounded-lg border p-3"><p className="text-xs text-[var(--text-tertiary)]">Generated</p><p className="font-medium">{new Date(props.aiReports[0].generatedAt).toLocaleString()}</p></div>}
                  </div>
                  {props.aiReports[0].summary && <div className="rounded-lg bg-[var(--surface-hover)] p-3 text-sm whitespace-pre-wrap">{props.aiReports[0].summary}</div>}
                </CardContent>
              </details>
            </Card>
          )}

          {props.phase === "COMPLETE" && props.generatedPapers.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Generated Papers</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  {props.generatedPapers.map((paper) => (
                    <div key={paper.id} className="rounded-lg border p-4">
                      <p className="text-lg font-semibold">{paper.variant.replace("PAPER_", "Paper ")}</p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Status</span><span>{paper.status}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Questions</span><span>{paper.questionCount}</span></div>
                        {paper.coverageScore != null && <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Coverage</span><span>{paper.coverageScore}%</span></div>}
                        {paper.qualityScore != null && <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Quality</span><span>{paper.qualityScore}/10</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {props.deanReview && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Dean Review</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3"><p className="text-xs text-[var(--text-tertiary)]">Regular</p><p className="mt-1 font-medium">{props.deanReview.regularPaper.replace("PAPER_", "Paper ")}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-[var(--text-tertiary)]">Supplementary</p><p className="mt-1 font-medium">{props.deanReview.supplementaryPaper.replace("PAPER_", "Paper ")}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-[var(--text-tertiary)]">KT</p><p className="mt-1 font-medium">{props.deanReview.ktPaper.replace("PAPER_", "Paper ")}</p></div>
                </div>
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">Reviewed by {props.deanReview.reviewedBy} · {new Date(props.deanReview.reviewedAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <BankActionsPanel questionBankId={props.bankId} phase={props.phase} recordStatus={props.recordStatus} />
          
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Coverage</CardTitle></CardHeader>
            <CardContent><CoverageStats slots={props.slots} totalSlots={props.totalSlots} /></CardContent>
          </Card>

          <AssignPanelWrapper bankId={props.bankId} role="CONTRIBUTOR" title="Contributors" currentAssignments={props.contributors} />
          <AssignPanelWrapper bankId={props.bankId} role="MODERATOR" title="Moderator" currentAssignments={props.moderators} />

          <WorkflowTimeline phase={props.phase} recordStatus={props.recordStatus} />
          <NextStepGuidance phase={props.phase} recordStatus={props.recordStatus} />
        </div>
      </div>
    </div>
  );
}
