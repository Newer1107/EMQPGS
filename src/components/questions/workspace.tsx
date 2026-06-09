"use client";

import { useMemo, useState } from "react";
import type { CourseOutcome, DifficultyLevel, Prisma, RbtLevel, Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";
import { courseOutcomeLabels, difficultyLabels, questionStatusLabels, rbtLevelLabels } from "@/lib/constants";

type WorkspaceQuestionBank = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: true;
    assignments: { include: { teacher: true } };
    questionSlots: {
      include: {
        reservedBy: true;
        question: {
          include: {
            contributor: true;
            attachments: { include: { fileAsset: true } };
          };
        };
      };
    };
    questions: {
      include: {
        contributor: true;
        attachments: { include: { fileAsset: true } };
      };
    };
  };
}>;

type Actor = {
  id: string;
  role: Role;
};

const courseOutcomes = Object.entries(courseOutcomeLabels) as [CourseOutcome, string][];
const rbtLevels = Object.entries(rbtLevelLabels) as [RbtLevel, string][];
const difficulties = Object.entries(difficultyLabels) as [DifficultyLevel, string][];

type Notification = { type: "success" | "error"; message: string };

export function QuestionWorkspace({
  actor,
  questionBank,
  mode,
}: {
  actor: Actor;
  questionBank: WorkspaceQuestionBank;
  mode: "contributor" | "moderator" | "coordinator";
}) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [busyKey, setBusyKey] = useState("");

  const showSuccess = (msg: string) => setNotification({ type: "success", message: msg });
  const showError = (msg: string) => setNotification({ type: "error", message: msg });

  const visibleQuestions = useMemo(() => {
    if (mode === "contributor") {
      return questionBank.questions.filter((question) => question.contributorId === actor.id);
    }
    return questionBank.questions;
  }, [actor.id, mode, questionBank.questions]);

  const creatableSlots = useMemo(
    () =>
      questionBank.questionSlots.filter((slot) => {
        const owned = slot.reservedById === actor.id;
        const moderatorAccess = mode === "moderator" && !!slot.reservedById;
        return !slot.question && (owned || moderatorAccess);
      }),
    [actor.id, mode, questionBank.questionSlots],
  );

  async function reserveSlot(formData: FormData) {
    setBusyKey("reserve");
    const payload = {
      questionBankId: questionBank.id,
      moduleNumber: Number(formData.get("moduleNumber")),
      marks: Number(formData.get("marks")),
      slotNumber: Number(formData.get("slotNumber")),
    };

    const response = await apiFetch("/api/question-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    setBusyKey("");
    if (result.success) {
      showSuccess("Slot reserved successfully");
    } else {
      showError(result.error?.message ?? "Unable to reserve slot");
    }
  }

  async function saveQuestion(formData: FormData) {
    setBusyKey("question");
    const questionId = String(formData.get("questionId") || "");
    const payload = {
      slotId: String(formData.get("slotId") || ""),
      questionText: String(formData.get("questionText") || ""),
      coMapping: String(formData.get("coMapping") || ""),
      rbtLevel: String(formData.get("rbtLevel") || ""),
      teachingIndex: String(formData.get("teachingIndex") || "") || null,
      difficultyLevel: String(formData.get("difficultyLevel") || "") || null,
    };

    const response = await apiFetch(questionId ? `/api/questions/${questionId}` : "/api/questions", {
      method: questionId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    setBusyKey("");
    if (result.success) {
      showSuccess("Question saved successfully");
    } else {
      showError(result.error?.message ?? "Unable to save question");
    }
  }

  async function submitQuestion(questionId: string) {
    setBusyKey(questionId);
    const response = await apiFetch(`/api/questions/${questionId}/submit`, { method: "POST" });
    const result = await response.json();
    setBusyKey("");
    if (result.success) {
      showSuccess("Question submitted for moderation");
    } else {
      showError(result.error?.message ?? "Unable to submit");
    }
  }

  async function moderateQuestion(questionId: string, action: "APPROVE" | "REJECT" | "REQUEST_REVISION") {
    const remark = window.prompt("Optional moderation remark") ?? "";
    setBusyKey(`${questionId}-${action}`);
    const response = await apiFetch(`/api/questions/${questionId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, remark }),
    });
    const result = await response.json();
    setBusyKey("");
    if (result.success) {
      showSuccess("Moderation action recorded");
    } else {
      showError(result.error?.message ?? "Unable to moderate");
    }
  }

  async function uploadAttachment(questionId: string, file: File) {
    setBusyKey(`upload-${questionId}`);
    const presignResponse = await apiFetch(`/api/questions/${questionId}/attachments/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size }),
    });
    const presignResult = await presignResponse.json();
    if (!presignResult.success) {
      setBusyKey("");
      showError(presignResult.error?.message ?? "Unable to create upload URL");
      return;
    }

    await fetch(presignResult.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    const attachResponse = await apiFetch(`/api/questions/${questionId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileAssetId: presignResult.data.asset.id }),
    });
    const attachResult = await attachResponse.json();
    setBusyKey("");
    if (attachResult.success) {
      showSuccess("Attachment uploaded");
    } else {
      showError(attachResult.error?.message ?? "Unable to attach file");
    }
  }

  async function openAttachment(attachmentId: string) {
    const response = await fetch(`/api/question-attachments/${attachmentId}/download`);
    const result = await response.json();
    if (result.success) {
      window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
    } else {
      showError(result.error?.message ?? "Unable to open attachment");
    }
  }

  async function deleteAttachment(attachmentId: string) {
    const response = await apiFetch(`/api/question-attachments/${attachmentId}`, { method: "DELETE" });
    const result = await response.json();
    if (result.success) {
      showSuccess("Attachment deleted");
    } else {
      showError(result.error?.message ?? "Unable to delete attachment");
    }
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          notification.type === "success"
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {notification.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{questionBank.subject.subjectCode} — Contribution Matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            {questionBank.subject.subjectName} &middot; {questionBank.examCycle.academicYear} &middot; Semester {questionBank.examCycle.semester}
          </p>
          {Array.from({ length: 6 }, (_, index) => index + 1).map((moduleNumber) => (
            <div key={moduleNumber} className="space-y-3">
              <h3 className="text-lg font-semibold">Module {moduleNumber}</h3>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <Table>
                  <THead>
                    <TR>
                      <TH>Marks</TH>
                      {Array.from({ length: 7 }, (_, slotIndex) => (
                        <TH key={slotIndex}>Slot {slotIndex + 1}</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {[2, 5, 10].map((marks) => (
                      <TR key={`${moduleNumber}-${marks}`}>
                        <TD className="font-medium">{marks} Marks</TD>
                        {questionBank.questionSlots
                          .filter((slot) => slot.moduleNumber === moduleNumber && slot.marks === marks)
                          .map((slot) => (
                            <TD key={slot.id}>
                              <SlotCell actor={actor} mode={mode} slot={slot} onReserve={reserveSlot} busyKey={busyKey} />
                            </TD>
                          ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {(mode === "contributor" || mode === "moderator") && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Reserve Slot</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" action={async (formData) => reserveSlot(formData)}>
                <FieldSelect name="moduleNumber" label="Module" options={Array.from({ length: 6 }, (_, i) => ({ value: String(i + 1), label: `Module ${i + 1}` }))} />
                <FieldSelect name="marks" label="Marks" options={[2, 5, 10].map((mark) => ({ value: String(mark), label: `${mark} Marks` }))} />
                <FieldSelect name="slotNumber" label="Slot" options={Array.from({ length: 7 }, (_, i) => ({ value: String(i + 1), label: `Slot ${i + 1}` }))} />
                <Button type="submit" disabled={busyKey === "reserve"}>
                  {busyKey === "reserve" ? "Reserving..." : "Reserve Slot"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create or Update Question</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" action={async (formData) => saveQuestion(formData)}>
                <FieldSelect
                  name="questionId"
                  label="Edit Existing Question (optional)"
                  options={[{ value: "", label: "Create new question" }, ...visibleQuestions.map((question) => ({ value: question.id, label: `Module ${question.moduleNumber} · ${question.marks}M · Slot ${question.slotNumber}` }))]}
                />
                <FieldSelect
                  name="slotId"
                  label="Reserved Slot"
                  options={creatableSlots.map((slot) => ({ value: slot.id, label: `Module ${slot.moduleNumber} · ${slot.marks}M · Slot ${slot.slotNumber}` }))}
                />
                <div className="space-y-2">
                  <Label htmlFor="questionText">Question Text</Label>
                  <Textarea id="questionText" name="questionText" />
                </div>
                <FieldSelect name="coMapping" label="CO Mapping" options={courseOutcomes.map(([value, label]) => ({ value, label }))} />
                <FieldSelect name="rbtLevel" label="RBT Level" options={rbtLevels.map(([value, label]) => ({ value, label }))} />
                <div className="space-y-2">
                  <Label htmlFor="teachingIndex">Teaching Index</Label>
                  <Input id="teachingIndex" name="teachingIndex" />
                </div>
                <FieldSelect name="difficultyLevel" label="Difficulty" options={difficulties.map(([value, label]) => ({ value, label }))} />
                <Button type="submit" disabled={busyKey === "question"}>
                  {busyKey === "question" ? "Saving..." : "Save Question"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{mode === "moderator" ? "Moderation Dashboard" : mode === "coordinator" ? "Question Review" : "My Questions"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Module</TH>
                  <TH>Marks</TH>
                  <TH>Slot</TH>
                  <TH>Contributor</TH>
                  <TH>Status</TH>
                  <TH>Content</TH>
                  <TH>Attachments</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {visibleQuestions.map((question) => (
                  <TR key={question.id}>
                    <TD>{question.moduleNumber}</TD>
                    <TD>{question.marks}</TD>
                    <TD>{question.slotNumber}</TD>
                    <TD>{mode === "contributor" ? "You" : question.contributor.name}</TD>
                    <TD>
                      <Badge>{questionStatusLabels[question.status]}</Badge>
                    </TD>
                    <TD className="max-w-xs">
                      <p className="line-clamp-2 text-sm">{question.questionText}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {question.coMapping} &middot; {question.rbtLevel} &middot; {question.difficultyLevel ?? "Unspecified"}
                      </p>
                      {question.moderatorRemark && (
                        <p className="mt-1 text-xs italic text-[var(--muted-foreground)]">Remark: {question.moderatorRemark}</p>
                      )}
                    </TD>
                    <TD>
                      <div className="space-y-2">
                        {question.attachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center gap-2 rounded border border-[var(--border)] px-3 py-2 text-xs">
                            <span className="flex-1 truncate">{attachment.fileAsset.fileName}</span>
                            <Button size="sm" variant="outline" type="button" onClick={() => openAttachment(attachment.id)}>
                              View
                            </Button>
                            {(mode === "contributor" || mode === "moderator") && (
                              <Button size="sm" variant="ghost" type="button" onClick={() => deleteAttachment(attachment.id)}>
                                Delete
                              </Button>
                            )}
                          </div>
                        ))}
                        {(mode === "contributor" || mode === "moderator") && (
                          <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]">
                            Upload file
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadAttachment(question.id, file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-2">
                        {mode === "contributor" && question.status !== "SUBMITTED" && question.status !== "APPROVED" ? (
                          <Button size="sm" type="button" onClick={() => submitQuestion(question.id)} disabled={busyKey === question.id}>
                            {busyKey === question.id ? "..." : "Submit"}
                          </Button>
                        ) : null}
                        {mode === "moderator" ? (
                          <>
                            <Button size="sm" type="button" onClick={() => moderateQuestion(question.id, "APPROVE")} disabled={busyKey === `${question.id}-APPROVE`}>
                              Approve
                            </Button>
                            <Button size="sm" variant="secondary" type="button" onClick={() => moderateQuestion(question.id, "REQUEST_REVISION")} disabled={busyKey === `${question.id}-REQUEST_REVISION`}>
                              Request Revision
                            </Button>
                            <Button size="sm" variant="outline" type="button" onClick={() => moderateQuestion(question.id, "REJECT")} disabled={busyKey === `${question.id}-REJECT`}>
                              Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">No actions</span>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SlotCell({
  slot,
  mode,
  actor,
  onReserve,
  busyKey,
}: {
  slot: WorkspaceQuestionBank["questionSlots"][number];
  mode: "contributor" | "moderator" | "coordinator";
  actor: Actor;
  onReserve: (formData: FormData) => Promise<void>;
  busyKey: string;
}) {
  const reservedByYou = slot.reservedById === actor.id;
  const occupiedByOther = mode === "contributor" && slot.reservedById && slot.reservedById !== actor.id;

  if (slot.question) {
    return (
      <div className="rounded border border-[var(--border)] bg-[var(--muted)] p-2 text-center text-xs">
        <Badge>{questionStatusLabels[slot.question.status]}</Badge>
        <p className="mt-1 truncate">{slot.question.questionText.slice(0, 24)}</p>
      </div>
    );
  }

  if (occupiedByOther) {
    return <div className="rounded border border-[var(--border)] bg-[var(--muted)] p-2 text-center text-xs text-[var(--muted-foreground)]">Reserved</div>;
  }

  if (reservedByYou) {
    return <div className="rounded border border-[var(--foreground)] bg-[var(--foreground)] p-2 text-center text-xs font-medium text-white">Yours</div>;
  }

  if (slot.reservedById && mode !== "moderator") {
    return <div className="rounded border border-[var(--border)] bg-[var(--muted)] p-2 text-center text-xs text-[var(--muted-foreground)]">Reserved</div>;
  }

  if (mode === "coordinator") {
    return <div className="rounded border border-[var(--border)] p-2 text-center text-xs text-[var(--muted-foreground)]">Open</div>;
  }

  return (
    <form
      action={async () => {
        const formData = new FormData();
        formData.set("moduleNumber", String(slot.moduleNumber));
        formData.set("marks", String(slot.marks));
        formData.set("slotNumber", String(slot.slotNumber));
        await onReserve(formData);
      }}
    >
      <Button size="sm" variant="outline" type="submit" disabled={busyKey === "reserve"} className="w-full">
        {mode === "moderator" && slot.reservedById ? "Override" : "Claim"}
      </Button>
    </form>
  );
}

function FieldSelect({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select id={name} name={name} defaultValue={options[0]?.value ?? ""}>
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
