"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";
import { questionStatusLabels } from "@/lib/constants";

type QuestionItem = {
  id: string;
  questionText: string;
  marks: number;
  moduleNumber: number;
  coMapping: string;
  rbtLevel: string;
  difficultyLevel: string | null;
  status: string;
  submittedAt: string | null;
  contributor: {
    name: string;
    email: string;
  };
  questionBank: {
    id: string;
    subject: {
      subjectName: string;
      subjectCode: string;
    };
    examCycle: {
      academicYear: string;
      semester: number;
      examType: string;
    };
    status?: string;
  };
};

type QuestionDetail = {
  id: string;
  questionText: string;
  markType: number;
  moduleNumber: number;
  co: string;
  rbtLevel: string;
  difficultyLevel: string | null;
  status: string;
  contributor: {
    id: string;
    name: string;
    email: string;
  };
  bank: {
    id: string;
    subjectName: string;
    subjectCode: string;
    examCycle: string;
    status: string;
  };
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    downloadUrl: string;
  }>;
  revisionHistory: Array<{
    id: string;
    versionNumber: number | null;
    questionText: string | null;
    actor: string;
    actorEmail: string;
    moderatorComment: string | null;
    submittedAt: string;
    action?: string;
  }>;
  moderatorComments: Array<{
    id: string;
    action: string;
    note: string | null;
    moderatorName: string;
    createdAt: string;
  }>;
};

async function readApi<T>(input: string, init?: RequestInit) {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: `Request failed with status ${response.status}` } }));
    throw new Error(body.error?.message ?? `Request failed with status ${response.status}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message ?? "Request failed");
  }
  return result.data as T;
}

export function ModerationWorkspace() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    module: "",
    markType: "",
    bankId: "",
    contributorName: "",
    sortBy: "submittedAtAsc",
  });

  const banks = useMemo(() => {
    const map = new Map<string, string>();
    for (const question of questions) {
      map.set(
        question.questionBank.id,
        `${question.questionBank.subject.subjectCode} / ${question.questionBank.examCycle.academicYear} / Sem ${question.questionBank.examCycle.semester}`,
      );
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [questions]);

  async function loadQuestions() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.module) params.set("module", filters.module);
      if (filters.markType) params.set("markType", filters.markType);
      if (filters.bankId) params.set("bankId", filters.bankId);
      if (filters.contributorName) params.set("contributorName", filters.contributorName);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);

      const data = await readApi<QuestionItem[]>(`/api/moderation/questions${params.toString() ? `?${params.toString()}` : ""}`);
      setQuestions(data);
      if (selectedQuestionId && !data.some((question) => question.id === selectedQuestionId)) {
        setSelectedQuestionId(null);
        setDetail(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load moderation queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQuestions();
  }, [filters.status, filters.module, filters.markType, filters.bankId, filters.contributorName, filters.sortBy]);

  useEffect(() => {
    if (!selectedQuestionId) return;
    let cancelled = false;

    const loadDetail = async () => {
      setDetailLoading(true);
      setActionError(null);
      try {
        const data = await readApi<QuestionDetail>(`/api/moderation/questions/${selectedQuestionId}`);
        if (!cancelled) {
          setDetail(data);
          setNote("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setActionError(loadError instanceof Error ? loadError.message : "Failed to load question detail.");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedQuestionId]);

  async function runAction(action: "approve" | "reject" | "request-revision" | "override") {
    if (!detail) return;
    if ((action === "reject" || action === "request-revision") && !note.trim()) {
      setActionError(action === "reject" ? "Rejection reason is required." : "Revision instructions are required.");
      return;
    }

    setActionError(null);
    try {
      await readApi(`/api/moderation/questions/${detail.id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body:
          action === "reject"
            ? JSON.stringify({ reason: note.trim() })
            : action === "request-revision"
              ? JSON.stringify({ instructions: note.trim() })
              : undefined,
      });

      toast.success(
        action === "approve"
          ? "Question approved."
          : action === "reject"
            ? "Question rejected."
            : action === "request-revision"
              ? "Revision requested."
              : "Question returned to pending review.",
      );
      await loadQuestions();
      const fresh = await readApi<QuestionDetail>(`/api/moderation/questions/${detail.id}`);
      setDetail(fresh);
      setNote("");
    } catch (runError) {
      setActionError(runError instanceof Error ? runError.message : "Moderation action failed.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
      <Card>
        <CardHeader>
          <CardTitle>Moderation Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="REVISION_SUBMITTED">Revision Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="REVISION_REQUESTED">Revision Requested</option>
            </Select>
            <Select value={filters.module} onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}>
              <option value="">All modules</option>
              {Array.from({ length: 6 }, (_, index) => index + 1).map((moduleNumber) => (
                <option key={moduleNumber} value={String(moduleNumber)}>
                  Module {moduleNumber}
                </option>
              ))}
            </Select>
            <Select value={filters.markType} onChange={(event) => setFilters((current) => ({ ...current, markType: event.target.value }))}>
              <option value="">All mark types</option>
              {[2, 5, 10].map((mark) => (
                <option key={mark} value={String(mark)}>
                  {mark}-mark
                </option>
              ))}
            </Select>
            <Select value={filters.bankId} onChange={(event) => setFilters((current) => ({ ...current, bankId: event.target.value }))}>
              <option value="">All assigned banks</option>
              {banks.map((bank) => (
                <option key={bank.value} value={bank.value}>
                  {bank.label}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Search contributor"
              value={filters.contributorName}
              onChange={(event) => setFilters((current) => ({ ...current, contributorName: event.target.value }))}
            />
            <Select value={filters.sortBy} onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value }))}>
              <option value="submittedAtAsc">Submission date oldest first</option>
              <option value="submittedAtDesc">Submission date newest first</option>
              <option value="markType">Mark value</option>
              <option value="moduleNumber">Module number</option>
            </Select>
          </div>

          {error ? (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
              <Button type="button" onClick={() => void loadQuestions()}>
                Retry
              </Button>
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading moderation queue...</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <Table>
                <THead>
                  <TR>
                    <TH>Question</TH>
                    <TH>Marks</TH>
                    <TH>Module</TH>
                    <TH>CO</TH>
                    <TH>RBT</TH>
                    <TH>Status</TH>
                    <TH>Contributor</TH>
                    <TH>Submitted At</TH>
                  </TR>
                </THead>
                <TBody>
                  {questions.length === 0 ? (
                    <TR>
                      <TD colSpan={8} className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                        No matching questions found.
                      </TD>
                    </TR>
                  ) : (
                    questions.map((question) => (
                      <TR
                        key={question.id}
                        className={`cursor-pointer ${selectedQuestionId === question.id ? "bg-[var(--muted)]" : ""}`}
                        onClick={() => setSelectedQuestionId(question.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedQuestionId(question.id);
                          }
                        }}
                      >
                        <TD className="max-w-sm whitespace-normal">
                          <p className="line-clamp-2">{question.questionText}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {question.questionBank.subject.subjectCode} / {question.questionBank.examCycle.academicYear}
                          </p>
                        </TD>
                        <TD>{question.marks}</TD>
                        <TD>{question.moduleNumber}</TD>
                        <TD>{question.coMapping}</TD>
                        <TD>{question.rbtLevel}</TD>
                        <TD>{questionStatusLabels[question.status as keyof typeof questionStatusLabels] ?? question.status}</TD>
                        <TD>
                          <p>{question.contributor.name}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">{question.contributor.email}</p>
                        </TD>
                        <TD>{question.submittedAt ? new Date(question.submittedAt).toLocaleString() : "Not submitted"}</TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Question Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedQuestionId ? (
            <p className="text-sm text-[var(--muted-foreground)]">Select a question to review its full content, history, and attachments.</p>
          ) : detailLoading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading question detail...</p>
          ) : detail ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">{detail.bank.subjectCode} · {detail.bank.subjectName}</p>
                <p className="text-sm text-[var(--muted-foreground)]">{detail.bank.examCycle}</p>
                <p className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-sm whitespace-pre-wrap">{detail.questionText}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <p>Marks: {detail.markType}</p>
                <p>Module: {detail.moduleNumber}</p>
                <p>CO: {detail.co}</p>
                <p>RBT: {detail.rbtLevel}</p>
                <p>Difficulty: {detail.difficultyLevel ?? "Unspecified"}</p>
                <p>Status: {questionStatusLabels[detail.status as keyof typeof questionStatusLabels] ?? detail.status}</p>
              </div>

              <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
                <p className="font-medium">{detail.contributor.name}</p>
                <p className="text-[var(--muted-foreground)]">{detail.contributor.email}</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Attachments</p>
                {detail.attachments.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">No attachments.</p> : null}
                {detail.attachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-lg border border-[var(--border)] p-3">
                    <p className="mb-2 text-sm font-medium">{attachment.fileName}</p>
                    {attachment.mimeType.startsWith("image/") ? (
                      <img src={attachment.downloadUrl} alt={attachment.fileName} className="max-h-64 rounded-lg border border-[var(--border)] object-contain" />
                    ) : (
                      <a href={attachment.downloadUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                        Open attachment
                      </a>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Revision History</p>
                {detail.revisionHistory.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                    <p className="font-medium">{entry.actor}</p>
                    <p className="text-[var(--muted-foreground)]">{new Date(entry.submittedAt).toLocaleString()}</p>
                    {entry.action ? <p className="mt-1">{entry.action}</p> : null}
                    {entry.questionText ? <p className="mt-2 whitespace-pre-wrap">{entry.questionText}</p> : null}
                    {entry.moderatorComment ? <p className="mt-2 italic text-[var(--muted-foreground)]">{entry.moderatorComment}</p> : null}
                  </div>
                ))}
              </div>

              {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

              {(detail.status === "PENDING" || detail.status === "REVISION_SUBMITTED") ? (
                <div className="space-y-3 rounded-lg border border-[var(--border)] p-4">
                  <div className="space-y-2">
                    <Label htmlFor="moderator-note">Reason / Instructions</Label>
                    <Textarea id="moderator-note" value={note} onChange={(event) => setNote(event.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void runAction("approve")}>Approve</Button>
                    <Button type="button" variant="outline" onClick={() => void runAction("reject")}>Reject</Button>
                    <Button type="button" variant="secondary" onClick={() => void runAction("request-revision")}>Request Revision</Button>
                  </div>
                </div>
              ) : null}

              {detail.status === "APPROVED" && detail.bank.status !== "LOCKED" ? (
                <Button type="button" variant="outline" onClick={() => void runAction("override")}>
                  Override
                </Button>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
