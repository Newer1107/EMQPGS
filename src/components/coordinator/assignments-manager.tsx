"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/client-fetch";

type QuestionBankSummary = {
  id: string;
  subject: {
    subjectCode: string;
    subjectName: string;
  };
  examCycle: {
    academicYear: string;
    semester: number;
    examType: string;
  };
};

type AssignmentSummary = {
  assignmentId: string;
  moduleNumber: number;
  contributor: {
    id: string;
    name: string;
    email: string;
  };
  questionsSubmittedCount: number;
  canReassign: boolean;
};

type ContributorOption = {
  id: string;
  name: string;
  email: string;
};

type BankAssignments = Record<string, AssignmentSummary[]>;

async function readApi<T>(input: string, init?: RequestInit) {
  const response = await apiFetch(input, init);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Request failed");
  }
  return result.data as T;
}

export function AssignmentsManager() {
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [assignmentsByBank, setAssignmentsByBank] = useState<BankAssignments>({});
  const [contributors, setContributors] = useState<ContributorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<{ bankId: string; moduleNumber: number; assignmentId?: string } | null>(null);
  const [selectedContributorId, setSelectedContributorId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [bankData, contributorData] = await Promise.all([
        readApi<QuestionBankSummary[]>("/api/question-banks"),
        readApi<ContributorOption[]>("/api/users?role=CONTRIBUTOR"),
      ]);
      const assignmentEntries = await Promise.all(
        bankData.map(async (bank) => [bank.id, await readApi<AssignmentSummary[]>(`/api/question-banks/${bank.id}/assignments`)] as const),
      );

      setBanks(bankData);
      setContributors(contributorData);
      setAssignmentsByBank(Object.fromEntries(assignmentEntries));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load assignment data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const contributorOptions = useMemo(
    () => contributors.map((contributor) => ({ value: contributor.id, label: `${contributor.name} (${contributor.email})` })),
    [contributors],
  );

  async function refreshBank(bankId: string) {
    const data = await readApi<AssignmentSummary[]>(`/api/question-banks/${bankId}/assignments`);
    setAssignmentsByBank((current) => ({ ...current, [bankId]: data }));
  }

  async function submitAssignment() {
    if (!activeEditor || !selectedContributorId) {
      setInlineError("Select a contributor to continue.");
      return;
    }

    setSubmitting(true);
    setInlineError(null);

    try {
      const method = activeEditor.assignmentId ? "PUT" : "POST";
      const url = activeEditor.assignmentId
        ? `/api/question-banks/${activeEditor.bankId}/assignments/${activeEditor.assignmentId}`
        : `/api/question-banks/${activeEditor.bankId}/assignments`;

      await readApi(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          activeEditor.assignmentId
            ? { contributorId: selectedContributorId }
            : { moduleNumber: activeEditor.moduleNumber, contributorId: selectedContributorId },
        ),
      });

      await refreshBank(activeEditor.bankId);
      setActiveEditor(null);
      setSelectedContributorId("");
      toast.success(activeEditor.assignmentId ? "Assignment updated." : "Contributor assigned.");
    } catch (submitError) {
      setInlineError(submitError instanceof Error ? submitError.message : "Failed to save assignment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeAssignment(bankId: string, assignmentId: string) {
    const confirmed = window.confirm(
      "Removing this assignment will not delete questions already submitted by this contributor. It will only prevent them from submitting new questions to this module.",
    );
    if (!confirmed) return;

    try {
      await readApi(`/api/question-banks/${bankId}/assignments/${assignmentId}`, { method: "DELETE" });
      await refreshBank(bankId);
      toast.success("Assignment removed.");
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : "Failed to remove assignment.");
    }
  }

  async function notifyContributor(bankId: string, assignmentId: string, contributorName: string) {
    try {
      await readApi(`/api/question-banks/${bankId}/assignments/${assignmentId}/notify`, { method: "POST" });
      toast.success(`Notification sent to ${contributorName}.`);
    } catch (notifyError) {
      toast.error(notifyError instanceof Error ? notifyError.message : "Failed to send notification.");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted-foreground)]">Loading assignment matrix...</p>;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignment Data Unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-red-600">{error}</p>
          <Button type="button" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {banks.map((bank) => {
        const assignments = assignmentsByBank[bank.id] ?? [];
        return (
          <Card key={bank.id}>
            <CardHeader>
              <CardTitle>{bank.subject.subjectCode} · {bank.subject.subjectName}</CardTitle>
              <p className="text-sm text-[var(--muted-foreground)]">
                {bank.examCycle.academicYear} / Sem {bank.examCycle.semester} / {bank.examCycle.examType.replaceAll("_", " ")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Module</TH>
                    <TH>Contributor</TH>
                    <TH>Email</TH>
                    <TH>Questions Submitted</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {Array.from({ length: 6 }, (_, index) => index + 1).map((moduleNumber) => {
                    const assignment = assignments.find((item) => item.moduleNumber === moduleNumber);
                    const isEditing = activeEditor?.bankId === bank.id && activeEditor.moduleNumber === moduleNumber;

                    return (
                      <TR key={`${bank.id}-${moduleNumber}`}>
                        <TD className="font-medium">Module {moduleNumber}</TD>
                        <TD>{assignment?.contributor.name ?? "Unassigned"}</TD>
                        <TD>{assignment?.contributor.email ?? "—"}</TD>
                        <TD>{assignment?.questionsSubmittedCount ?? 0}</TD>
                        <TD>
                          <div className="flex flex-wrap gap-2">
                            {!assignment ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setActiveEditor({ bankId: bank.id, moduleNumber });
                                  setSelectedContributorId("");
                                  setInlineError(null);
                                }}
                              >
                                Assign
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={!assignment.canReassign}
                                  title={!assignment.canReassign ? "Cannot reassign - contributor has already submitted questions for this module." : undefined}
                                  onClick={() => {
                                    setActiveEditor({ bankId: bank.id, moduleNumber, assignmentId: assignment.assignmentId });
                                    setSelectedContributorId(assignment.contributor.id);
                                    setInlineError(null);
                                  }}
                                >
                                  Reassign
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => void removeAssignment(bank.id, assignment.assignmentId)}>
                                  Remove
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void notifyContributor(bank.id, assignment.assignmentId, assignment.contributor.name)}
                                >
                                  Notify
                                </Button>
                              </>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                              <Select value={selectedContributorId} onChange={(event) => setSelectedContributorId(event.target.value)}>
                                <option value="">Select contributor</option>
                                {contributorOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                              {inlineError ? <p className="text-sm text-red-600">{inlineError}</p> : null}
                              <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={() => void submitAssignment()} disabled={submitting}>
                                  {submitting ? "Saving..." : assignment ? "Confirm Reassign" : "Confirm Assign"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setActiveEditor(null);
                                    setSelectedContributorId("");
                                    setInlineError(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
