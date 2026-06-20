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
      };
    };
  }>;
};

type Props = {
  questions: QuestionData[];
  actorId: string;
};

export function ModerationQuestionsView({ questions }: Props) {
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
          const label = `${bank.subject.subjectCode} — ${bank.examCycle.examType.replaceAll("_", " ")} · Sem ${bank.examCycle.batchSemester.semesterNumber} (${bank.examCycle.batchSemester.academicYear.code})`;
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

  return (
    <div className="space-y-4">
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
                <TD colSpan={6} className="text-center text-sm text-[var(--text-tertiary)] py-8">
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
