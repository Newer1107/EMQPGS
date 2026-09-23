"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { QuestionStatus } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ActionButton } from "@/components/forms/action-button";
import { questionStatusLabels } from "@/lib/constants";
import { apiFetch } from "@/lib/client-fetch";

const statusVariants: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  APPROVED: "success",
  PENDING: "warning",
  REVISION_SUBMITTED: "info",
};

type BankInfo = {
  id: string;
  label: string;
};

type QuestionData = {
  id: string;
  status: string;
  moduleNumber: number;
  marks: number;
  subjectVersion: {
    subject: { subjectCode: string; subjectName: string };
  };
  creator: { name: string };
  slotAssignments: Array<{
    questionBank: {
      id: string;
      subject: { subjectCode: string; subjectName: string };
      examCycle: {
        examType: string;
        batchSemester: {
          semesterNumber: number;
          academicYear: { code: string };
        };
      } | null;
    };
  }>;
};

type Props = {
  questions: QuestionData[];
  actorId: string;
};

export function ModerationQuestionsView({ questions }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("approve");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(questions.map((q) => q.id)),
  );

  // Extract unique banks from all questions
  const banks = useMemo<BankInfo[]>(() => {
    const map = new Map<string, BankInfo>();
    for (const q of questions) {
      for (const sa of q.slotAssignments) {
        const bank = sa.questionBank;
        if (!map.has(bank.id)) {
          const cycle = bank.examCycle;
          const label = cycle
            ? `${bank.subject.subjectCode} — ${cycle.examType.replaceAll("_", " ")} · Sem ${cycle.batchSemester.semesterNumber} (${cycle.batchSemester.academicYear.code})`
            : `${bank.subject.subjectCode} (no cycle)`;
          map.set(bank.id, { id: bank.id, label });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [questions]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (!visibleIds.has(q.id)) return false;
      if (bankFilter === "all") return true;
      return q.slotAssignments.some((sa) => sa.questionBank.id === bankFilter);
    });
  }, [questions, bankFilter, visibleIds]);

  function handleApproved(id: string) {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function moderateSelected() {
    setBusy(true);
    setFeedback("");
    try {
      const response = await apiFetch("/api/moderation/questions/bulk", { method: "POST", body: JSON.stringify({ questionIds: [...selected], action: bulkAction, reason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? "Bulk moderation failed.");
      const data = body.data as { succeeded: number; results: Array<{ questionId: string; success: boolean; error?: string }> };
      data.results.filter(result => result.success).forEach(result => handleApproved(result.questionId));
      const failures = data.results.filter(result => !result.success);
      setSelected(new Set(failures.map(result => result.questionId)));
      setFeedback(`${data.succeeded} questions updated.${failures.length ? " " + failures.map(result => `${result.questionId}: ${result.error}`).join("; ") : ""}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Bulk moderation failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <span>{selected.size} selected</span>
        <select aria-label="Bulk moderation action" value={bulkAction} disabled={busy} onChange={event => setBulkAction(event.target.value)}>
          <option value="approve">Approve</option><option value="reject">Reject</option><option value="request-revision">Request revision</option>
        </select>
        {bulkAction !== "approve" && <input aria-label="Reason for bulk decision" className="rounded border px-2 py-1" value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} placeholder="Required reason or revision instructions" />}
        <Button disabled={busy || selected.size === 0 || (bulkAction !== "approve" && !reason.trim())} onClick={moderateSelected}>{busy ? "Updating…" : "Apply to selected"}</Button>
        {feedback && <p role="status" className="w-full text-sm">{feedback}</p>}
      </div>
      {/* Bank filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="bank-filter" className="text-sm font-medium text-[var(--text-secondary)]">
          Question Bank:
        </label>
        <select
          id="bank-filter"
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
        >
          <option value="all">All Banks</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <DataTableCard title={`Pending Review (${filtered.length})`}>
        <Table>
          <THead>
            <TR>
              <TH><input type="checkbox" aria-label="Select visible questions" disabled={busy} checked={filtered.length > 0 && filtered.every(q => selected.has(q.id))} onChange={event => setSelected(event.target.checked ? new Set(filtered.slice(0, 50).map(q => q.id)) : new Set())} /></TH>
              <TH>Subject</TH>
              <TH>Module</TH>
              <TH>Marks</TH>
              <TH>Status</TH>
              <TH>Contributor</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((question) => (
              <TR key={question.id}>
                <TD><input type="checkbox" aria-label={`Select question ${question.id}`} disabled={busy || (!selected.has(question.id) && selected.size >= 50)} checked={selected.has(question.id)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(question.id); else next.delete(question.id); return next; })} /></TD>
                <TD className="font-medium">
                  {question.subjectVersion.subject.subjectCode}
                </TD>
                <TD>{question.moduleNumber}</TD>
                <TD>{question.marks}</TD>
                <TD>
                  <Badge
                    variant={statusVariants[question.status] ?? "default"}
                  >
                    {questionStatusLabels[question.status as keyof typeof questionStatusLabels] ??
                      question.status}
                  </Badge>
                </TD>
                <TD>{question.creator.name}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <ActionButton
                      method="PATCH"
                      endpoint={`/api/moderation/questions/${question.id}/approve`}
                      label="Approve"
                      variant="default"
                      size="sm"
                      successMessage="Question approved"
                      onSuccess={() => handleApproved(question.id)}
                    />
                    <Link
                      href={`/dashboard/moderator/questions/${question.id}`}
                    >
                      <Button variant="outline" size="sm">
                        Review
                      </Button>
                    </Link>
                  </div>
                </TD>
              </TR>
            ))}
            {filtered.length === 0 && (
              <TR>
                <TD colSpan={7} className="text-center text-sm text-[var(--text-tertiary)] py-8">
                  No questions match the current filter.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
