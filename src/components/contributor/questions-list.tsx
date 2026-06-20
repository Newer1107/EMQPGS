"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { questionStatusLabels } from "@/lib/constants";
import { ActionButton } from "@/components/forms/action-button";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "REVISION_REQUESTED", label: "Revision Requested" },
  { value: "REVISION_SUBMITTED", label: "Revision Submitted" },
];

const statusVariants: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  APPROVED: "success",
  REJECTED: "danger",
  PENDING: "warning",
  DRAFT: "warning",
  REVISION_REQUESTED: "info",
  REVISION_SUBMITTED: "info",
};

type QuestionItem = {
  id: string;
  moduleNumber: number;
  marks: number;
  status: string;
  subjectVersion: {
    subject: { subjectCode: string };
  };
  slotAssignments: Array<{
    questionBank: { batchSemester: { semesterNumber: number } };
  }>;
};

export function QuestionsList({ questions, latestQuestionId }: { questions: QuestionItem[]; latestQuestionId?: string | null }) {
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = statusFilter === "ALL" ? questions : questions.filter((q) => q.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--text-tertiary)]">Status:</label>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <span className="text-xs text-[var(--text-tertiary)]">{filtered.length} of {questions.length} questions</span>
      </div>
      <DataTableCard title="Question Library">
        <Table>
          <THead>
            <TR>
              <TH>Subject</TH>
              <TH>Module</TH>
              <TH>Marks</TH>
              <TH>Status</TH>
              <TH>Linked Banks</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TR>
                <TD colSpan={6} className="text-center text-[var(--text-tertiary)] py-8">
                  No questions match the selected filter.
                </TD>
              </TR>
            ) : (
              filtered.map((question) => (
                <TR key={question.id} id={question.id === latestQuestionId && question.status === "DRAFT" ? "new-question" : undefined}>
                  <TD className="font-medium">{question.subjectVersion.subject.subjectCode}</TD>
                  <TD>{question.moduleNumber}</TD>
                  <TD>{question.marks}</TD>
                  <TD><Badge variant={statusVariants[question.status] ?? "default"}>{questionStatusLabels[question.status as keyof typeof questionStatusLabels] ?? question.status}</Badge></TD>
                  <TD>{question.slotAssignments.map((s) => `Sem ${s.questionBank.batchSemester.semesterNumber}`).join(", ") || "None"}</TD>
                  <TD>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/contributor/questions/${question.id}/edit`}>
                        <Button variant="outline" size="sm">Edit</Button>
                      </Link>
                      {question.status === "DRAFT" && (
                        <ActionButton
                          label="Submit"
                          endpoint={`/api/question-library/${question.id}?action=submit`}
                          method="POST"
                          confirmMessage="Submit this question for moderation?"
                          successMessage="Question submitted"
                          size="sm"
                        />
                      )}
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
