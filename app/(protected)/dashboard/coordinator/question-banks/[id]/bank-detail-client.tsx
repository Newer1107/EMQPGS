"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { questionBankPhaseLabels, recordStatusLabels, questionStatusLabels, difficultyLabels } from "@/lib/constants";
import { BankActionsPanel } from "@/components/forms/bank-actions-panel";
import { WorkflowTimeline } from "@/components/forms/workflow-timeline";
import { NextStepGuidance } from "@/components/forms/next-step-guidance";

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
  status: string;
};

type BankDetailClientProps = {
  bankId: string;
  subjectName: string;
  subjectCode: string;
  examCycleLabel: string;
  phase: string;
  recordStatus: string;
  totalSlots: number;
  totalModules: number;
  marksOptions: number[];
  slotsPerModule: number;
  slots: SlotItem[];
  aiReports: AiReportItem[];
  generatedPapers: GeneratedPaperItem[];
  deanReview: DeanReviewItem | null;
};

const MODULE_LABELS: Record<number, string> = {
  1: "Module 1", 2: "Module 2", 3: "Module 3",
  4: "Module 4", 5: "Module 5", 6: "Module 6",
};

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

function SlotCell({
  slot,
  isSelected,
  onClick,
}: {
  slot: SlotItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = slot.assignedQuestion?.status ?? null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        `relative flex h-9 w-9 items-center justify-center rounded border text-xs font-medium transition-colors ` +
        slotStatusClass(status) +
        (isSelected ? " ring-2 ring-[var(--foreground)]" : " hover:opacity-80") +
        (slot.isLocked ? " opacity-50 cursor-not-allowed" : " cursor-pointer")
      }
      title={`Slot ${slot.slotNumber} · ${slot.assignedQuestion?.questionText?.slice(0, 60) ?? "Empty"}`}
    >
      <span className={status ? "" : "text-[var(--muted-foreground)]"}>
        {slot.slotNumber}
      </span>
    </button>
  );
}

function SlotDetailPanel({ slot }: { slot: SlotItem }) {
  const q = slot.assignedQuestion;
  if (!q) {
    return (
      <Card>
        <CardHeader><CardTitle>Slot {slot.slotNumber} · Module {slot.moduleNumber} · {slot.marks} Marks</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted-foreground)]">No question assigned to this slot.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Slot {slot.slotNumber} · Module {slot.moduleNumber} · {slot.marks} Marks</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {q.coMapping} · {q.rbtLevel}
              {q.difficultyLevel ? ` · ${difficultyLabels[q.difficultyLevel as keyof typeof difficultyLabels] ?? q.difficultyLevel}` : ""}
            </p>
          </div>
          <Badge>{questionStatusLabels[q.status as keyof typeof questionStatusLabels] ?? q.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-[var(--muted)] p-4 text-sm whitespace-pre-wrap">
          {q.questionText}
        </div>
        <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <span>Contributor: {q.creator?.name ?? "Unknown"}</span>
          {q.creator && (
            <span className="text-xs">
              ID: {q.creator.id}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BankSummaryBar({ stats }: {
  stats: { total: number; filled: number; empty: number; approved: number; pending: number; rejected: number };
}) {
  const items = [
    { label: "Total", value: stats.total },
    { label: "Filled", value: stats.filled },
    { label: "Empty", value: stats.empty },
    { label: "Approved", value: stats.approved },
    { label: "Pending", value: stats.pending },
    { label: "Rejected", value: stats.rejected },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm">
          <span className="font-medium">{item.value}</span>
          <span className="text-[var(--muted-foreground)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ReadinessPanel({ phase, slots, totalSlots }: { phase: string; slots: SlotItem[]; totalSlots: number }) {
  const filledCount = slots.filter((s) => s.assignedQuestion).length;
  const emptyCount = totalSlots - filledCount;
  const pendingCount = slots.filter(
    (s) => s.assignedQuestion?.status === "PENDING" || s.assignedQuestion?.status === "REVISION_SUBMITTED",
  ).length;
  const draftCount = slots.filter((s) => s.assignedQuestion?.status === "DRAFT").length;
  const allFilled = emptyCount === 0;
  if (phase === "COMPLETE" || phase === "LOCKED") return null;

  const issues: string[] = [];
  const warnings: string[] = [];

  if (phase === "DRAFTING") {
    if (emptyCount > 0) issues.push(`${emptyCount} of ${totalSlots} slots have no question assigned.`);
    if (draftCount > 0) warnings.push(`${draftCount} questions still in draft. Submit before advancing.`);
  }

  if (phase === "MODERATION" || (phase === "DRAFTING" && allFilled)) {
    if (pendingCount > 0) issues.push(`${pendingCount} questions pending moderation review.`);
  }

  if (phase === "APPROVAL" || (phase === "MODERATION" && allFilled && pendingCount === 0)) {
    const cos = new Set(slots.map((s) => s.assignedQuestion?.coMapping).filter(Boolean));
    const rbts = new Set(slots.map((s) => s.assignedQuestion?.rbtLevel).filter(Boolean));
    if (cos.size < 3) warnings.push(`Only ${cos.size} COs covered (minimum 3 recommended).`);
    if (rbts.size < 3) warnings.push(`Only ${rbts.size} RBT levels covered (minimum 3 recommended).`);
  }

  if (issues.length === 0 && warnings.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Readiness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.map((issue, i) => (
          <div key={`issue-${i}`} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span className="mt-0.5 shrink-0">✗</span>
            <span>{issue}</span>
          </div>
        ))}
        {warnings.map((warning, i) => (
          <div key={`warn-${i}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span className="mt-0.5 shrink-0">△</span>
            <span>{warning}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AiReportSection({ reports, phase }: { reports: AiReportItem[]; phase: string }) {
  if (phase !== "APPROVAL" || reports.length === 0) return null;
  const report = reports[0];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">AI Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted-foreground)]">Status</p>
            <p className="font-medium">{report.status}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted-foreground)]">Model</p>
            <p className="font-medium">{report.modelName}</p>
          </div>
          {report.generatedAt && (
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--muted-foreground)]">Generated</p>
              <p className="font-medium">{new Date(report.generatedAt).toLocaleString()}</p>
            </div>
          )}
          {report.failureReason && (
            <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-[var(--muted-foreground)]">Failure</p>
              <p className="text-sm text-red-800">{report.failureReason}</p>
            </div>
          )}
        </div>
        {report.summary && (
          <div className="rounded-lg bg-[var(--muted)] p-3 text-sm whitespace-pre-wrap">
            {report.summary}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GeneratedPapersSection({ papers, phase }: { papers: GeneratedPaperItem[]; phase: string }) {
  if (phase !== "COMPLETE" || papers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Generated Papers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {papers.map((paper) => (
            <div key={paper.id} className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-lg font-semibold">{paper.variant.replace("PAPER_", "Paper ")}</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Status</span>
                  <span>{paper.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Questions</span>
                  <span>{paper.questionCount}</span>
                </div>
                {paper.coverageScore != null && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Coverage</span>
                    <span>{paper.coverageScore}%</span>
                  </div>
                )}
                {paper.qualityScore != null && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Quality</span>
                    <span>{paper.qualityScore}/10</span>
                  </div>
                )}
                {paper.duplicateRisk != null && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Duplicate Risk</span>
                    <span className={paper.duplicateRisk >= 20 ? "text-red-600 font-medium" : ""}>
                      {paper.duplicateRisk}%
                    </span>
                  </div>
                )}
              </div>
              {paper.recommendation && (
                <p className="mt-3 text-xs text-[var(--muted-foreground)] italic">
                  {paper.recommendation}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeanReviewSection({ review }: { review: DeanReviewItem | null }) {
  if (!review) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dean Review</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted-foreground)]">Regular Paper</p>
            <p className="mt-1 font-medium">{review.regularPaper.replace("PAPER_", "Paper ")}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted-foreground)]">Supplementary</p>
            <p className="mt-1 font-medium">{review.supplementaryPaper.replace("PAPER_", "Paper ")}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted-foreground)]">KT</p>
            <p className="mt-1 font-medium">{review.ktPaper.replace("PAPER_", "Paper ")}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Reviewed by {review.reviewedBy} · {new Date(review.reviewedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function SlotGrid({ slots, modules, marksOptions, selectedSlotId, onSlotClick }: {
  slots: SlotItem[];
  modules: number[];
  marksOptions: number[];
  selectedSlotId: string | null;
  onSlotClick: (slot: SlotItem) => void;
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Slot Grid</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">Click a slot to view question details. Color indicates status.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {modules.map((moduleNumber) => (
          <div key={moduleNumber}>
            <h3 className="text-sm font-semibold mb-2">{MODULE_LABELS[moduleNumber] ?? `Module ${moduleNumber}`}</h3>
            <div className="space-y-2">
              {marksOptions.map((marks) => {
                const key = `${moduleNumber}-${marks}`;
                const group = grid.get(key) ?? [];
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs text-[var(--muted-foreground)]">{marks} marks</span>
                    <div className="flex gap-1">
                      {group
                        .sort((a, b) => a.slotNumber - b.slotNumber)
                        .map((slot) => (
                          <SlotCell
                            key={slot.slotNumber}
                            slot={slot}
                            isSelected={selectedSlotId === `${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`}
                            onClick={() => onSlotClick(slot)}
                          />
                        ))}
                    </div>
                    {group.length === 0 && (
                      <span className="text-xs text-[var(--muted-foreground)]">No slots</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BankDetailClient(props: BankDetailClientProps) {
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  const modules = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i <= props.totalModules; i++) arr.push(i);
    return arr;
  }, [props.totalModules]);

  const filledCount = props.slots.filter((s) => s.assignedQuestion).length;
  const approvedCount = props.slots.filter((s) => s.assignedQuestion?.status === "APPROVED").length;
  const pendingCount = props.slots.filter(
    (s) =>
      s.assignedQuestion?.status === "PENDING" ||
      s.assignedQuestion?.status === "REVISION_SUBMITTED",
  ).length;
  const rejectedCount = props.slots.filter(
    (s) =>
      s.assignedQuestion?.status === "REJECTED" ||
      s.assignedQuestion?.status === "REVISION_REQUESTED",
  ).length;
  const emptyCount = props.totalSlots - filledCount;

  const stats = {
    total: props.totalSlots,
    filled: filledCount,
    empty: emptyCount,
    approved: approvedCount,
    pending: pendingCount,
    rejected: rejectedCount,
  };

  function handleSlotClick(slot: SlotItem) {
    const key = `${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`;
    const selectedKey = selectedSlot
      ? `${selectedSlot.moduleNumber}-${selectedSlot.marks}-${selectedSlot.slotNumber}`
      : null;
    if (selectedKey === key) {
      setSelectedSlot(null);
    } else {
      setSelectedSlot(slot);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{props.subjectName}</h1>
          <p className="text-[var(--muted-foreground)]">
            {props.subjectCode} &middot; {props.examCycleLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{questionBankPhaseLabels[props.phase as keyof typeof questionBankPhaseLabels] ?? props.phase}</Badge>
          <Badge variant={props.recordStatus === "LOCKED" ? "danger" : props.recordStatus === "ACTIVE" ? "success" : "default"}>
            {recordStatusLabels[props.recordStatus as keyof typeof recordStatusLabels] ?? props.recordStatus}
          </Badge>
        </div>
      </div>

      <BankSummaryBar stats={stats} />

      <ReadinessPanel phase={props.phase} slots={props.slots} totalSlots={props.totalSlots} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SlotGrid
            slots={props.slots}
            modules={modules}
            marksOptions={props.marksOptions}
            selectedSlotId={
              selectedSlot
                ? `${selectedSlot.moduleNumber}-${selectedSlot.marks}-${selectedSlot.slotNumber}`
                : null
            }
            onSlotClick={handleSlotClick}
          />

          {selectedSlot && (
            <SlotDetailPanel slot={selectedSlot} />
          )}

          <AiReportSection reports={props.aiReports} phase={props.phase} />

          <GeneratedPapersSection papers={props.generatedPapers} phase={props.phase} />

          <DeanReviewSection review={props.deanReview} />
        </div>

        <div className="space-y-6">
          <BankActionsPanel questionBankId={props.bankId} phase={props.phase} recordStatus={props.recordStatus} />
          <WorkflowTimeline phase={props.phase} recordStatus={props.recordStatus} />
          <NextStepGuidance phase={props.phase} recordStatus={props.recordStatus} />
        </div>
      </div>
    </div>
  );
}
