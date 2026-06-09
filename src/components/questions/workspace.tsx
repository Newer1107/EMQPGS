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

export function QuestionWorkspace({
  actor,
  questionBank,
  mode,
}: {
  actor: Actor;
  questionBank: WorkspaceQuestionBank;
  mode: "contributor" | "moderator" | "coordinator";
}) {
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState("");

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

    const response = await fetch("/api/question-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    setBusyKey("");
    setMessage(result.success ? "Slot reserved successfully" : result.error?.message ?? "Unable to reserve slot");
    if (result.success) window.location.reload();
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

    const response = await fetch(questionId ? `/api/questions/${questionId}` : "/api/questions", {
      method: questionId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    setBusyKey("");
    setMessage(result.success ? "Question saved successfully" : result.error?.message ?? "Unable to save question");
    if (result.success) window.location.reload();
  }

  async function submitQuestion(questionId: string) {
    setBusyKey(questionId);
    const response = await fetch(`/api/questions/${questionId}/submit`, { method: "POST" });
    const result = await response.json();
    setBusyKey("");
    setMessage(result.success ? "Question submitted" : result.error?.message ?? "Unable to submit");
    if (result.success) window.location.reload();
  }

  async function moderateQuestion(questionId: string, action: "APPROVE" | "REJECT" | "REQUEST_REVISION") {
    const remark = window.prompt("Optional moderation remark") ?? "";
    setBusyKey(`${questionId}-${action}`);
    const response = await fetch(`/api/questions/${questionId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, remark }),
    });
    const result = await response.json();
    setBusyKey("");
    setMessage(result.success ? "Moderation action recorded" : result.error?.message ?? "Unable to moderate");
    if (result.success) window.location.reload();
  }

  async function uploadAttachment(questionId: string, file: File) {
    setBusyKey(`upload-${questionId}`);
    const presignResponse = await fetch(`/api/questions/${questionId}/attachments/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size }),
    });
    const presignResult = await presignResponse.json();
    if (!presignResult.success) {
      setBusyKey("");
      setMessage(presignResult.error?.message ?? "Unable to create upload URL");
      return;
    }

    await fetch(presignResult.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    const attachResponse = await fetch(`/api/questions/${questionId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileAssetId: presignResult.data.asset.id }),
    });
    const attachResult = await attachResponse.json();
    setBusyKey("");
    setMessage(attachResult.success ? "Attachment uploaded" : attachResult.error?.message ?? "Unable to attach file");
    if (attachResult.success) window.location.reload();
  }

  async function openAttachment(attachmentId: string) {
    const response = await fetch(`/api/question-attachments/${attachmentId}/download`);
    const result = await response.json();
    if (result.success) {
      window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
    } else {
      setMessage(result.error?.message ?? "Unable to open attachment");
    }
  }

  async function replaceAttachment(attachmentId: string, file: File) {
    const presignResponse = await fetch("/api/storage/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: "question-bank-attachments",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        linkedEntityType: "QUESTION_ATTACHMENT",
        linkedEntityId: attachmentId,
      }),
    });
    const presignResult = await presignResponse.json();
    if (!presignResult.success) {
      setMessage(presignResult.error?.message ?? "Unable to create replacement upload URL");
      return;
    }

    await fetch(presignResult.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    const response = await fetch(`/api/question-attachments/${attachmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileAssetId: presignResult.data.asset.id }),
    });
    const result = await response.json();
    setMessage(result.success ? "Attachment replaced" : result.error?.message ?? "Unable to replace attachment");
    if (result.success) window.location.reload();
  }

  async function deleteAttachment(attachmentId: string) {
    const response = await fetch(`/api/question-attachments/${attachmentId}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(result.success ? "Attachment deleted" : result.error?.message ?? "Unable to delete attachment");
    if (result.success) window.location.reload();
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <p className="page-kicker">Question Grid</p>
          <CardTitle className="mt-2 text-5xl">{questionBank.subject.subjectCode} Contribution Matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg italic text-[var(--muted-foreground)]">
            {questionBank.subject.subjectName} · {questionBank.examCycle.academicYear} · Semester {questionBank.examCycle.semester}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">{message}</p>
          {Array.from({ length: 6 }, (_, index) => index + 1).map((moduleNumber) => (
            <div key={moduleNumber} className="section-frame space-y-3">
              <h3 className="text-4xl">Module {moduleNumber}</h3>
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
                      <TD>{marks} Marks</TD>
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
          ))}
        </CardContent>
      </Card>

      {(mode === "contributor" || mode === "moderator") && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <p className="page-kicker">Claim</p>
              <CardTitle className="mt-2 text-4xl">Reserve Slot</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" action={async (formData) => reserveSlot(formData)}>
                <FieldSelect name="moduleNumber" label="Module" options={Array.from({ length: 6 }, (_, i) => ({ value: String(i + 1), label: `Module ${i + 1}` }))} />
                <FieldSelect name="marks" label="Marks" options={[2, 5, 10].map((mark) => ({ value: String(mark), label: `${mark} Marks` }))} />
                <FieldSelect name="slotNumber" label="Slot" options={Array.from({ length: 7 }, (_, i) => ({ value: String(i + 1), label: `Slot ${i + 1}` }))} />
                <Button type="submit" disabled={busyKey === "reserve"}>
                  Reserve Slot
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="page-kicker">Compose</p>
              <CardTitle className="mt-2 text-4xl">Create or Update Question</CardTitle>
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
                  Save Question
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <p className="page-kicker">Review</p>
          <CardTitle className="mt-2 text-4xl">{mode === "moderator" ? "Moderation Dashboard" : mode === "coordinator" ? "Read-only Question Review" : "My Questions"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Module</TH>
                <TH>Marks</TH>
                <TH>Slot</TH>
                <TH>Contributor</TH>
                <TH>Status</TH>
                <TH>Metadata</TH>
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
                    <p className="line-clamp-3 text-sm">{question.questionText}</p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
                      {question.coMapping} · {question.rbtLevel} · {question.difficultyLevel ?? "Unspecified"}
                    </p>
                    {question.moderatorRemark ? <p className="mt-2 text-xs italic">Remark: {question.moderatorRemark}</p> : null}
                  </TD>
                  <TD>
                    <div className="space-y-2">
                      {question.attachments.map((attachment) => (
                        <div key={attachment.id} className="border border-[var(--foreground)] p-3 text-xs">
                          <p>{attachment.fileAsset.fileName}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" type="button" onClick={() => openAttachment(attachment.id)}>
                              Preview
                            </Button>
                            {(mode === "contributor" || mode === "moderator") && (
                              <>
                                <label className="cursor-pointer border border-[var(--foreground)] px-3 py-1.5 text-xs uppercase tracking-[0.15em]">
                                  Replace
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (file) void replaceAttachment(attachment.id, file);
                                    }}
                                  />
                                </label>
                                <Button size="sm" variant="ghost" type="button" onClick={() => deleteAttachment(attachment.id)}>
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {(mode === "contributor" || mode === "moderator") && (
                        <label className="cursor-pointer border border-dashed border-[var(--foreground)] px-3 py-2 text-xs uppercase tracking-[0.15em] text-[var(--foreground)]">
                          Upload
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
                          Submit
                        </Button>
                      ) : null}
                      {mode === "moderator" ? (
                        <>
                          <Button size="sm" type="button" onClick={() => moderateQuestion(question.id, "APPROVE")} disabled={busyKey === `${question.id}-APPROVE`}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" type="button" onClick={() => moderateQuestion(question.id, "REQUEST_REVISION")} disabled={busyKey === `${question.id}-REQUEST_REVISION`}>
                            Revision
                          </Button>
                          <Button size="sm" variant="ghost" type="button" onClick={() => moderateQuestion(question.id, "REJECT")} disabled={busyKey === `${question.id}-REJECT`}>
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">No actions</span>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
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
    if (occupiedByOther) {
      return (
        <div className="space-y-1 border border-[var(--foreground)] bg-[var(--muted)] p-2">
          <Badge>Locked</Badge>
          <p className="text-xs text-[var(--muted-foreground)]">Occupied by another contributor</p>
        </div>
      );
    }

    return (
      <div className="space-y-1 border border-[var(--foreground)] bg-[var(--muted)] p-2">
        <Badge>{questionStatusLabels[slot.question.status]}</Badge>
        <p className="text-xs">{slot.question.questionText.slice(0, 36)}</p>
      </div>
    );
  }

  if (occupiedByOther) {
    return <div className="border border-[var(--border-light)] bg-[var(--muted)] p-2 text-xs text-[var(--muted-foreground)]">Reserved</div>;
  }

  if (reservedByYou) {
    return <div className="border border-[var(--foreground)] bg-[var(--foreground)] p-2 text-xs uppercase tracking-[0.15em] text-[var(--background)]">Reserved by you</div>;
  }

  if (slot.reservedById && mode !== "moderator") {
    return <div className="border border-[var(--border-light)] bg-[var(--muted)] p-2 text-xs text-[var(--muted-foreground)]">Reserved</div>;
  }

  if (mode === "coordinator") {
    return <div className="border border-[var(--foreground)] p-2 text-xs uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Open</div>;
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
      <Button size="sm" variant="outline" type="submit" disabled={busyKey === "reserve"}>
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
