"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";
import { SlotDemand, type SlotInfo } from "@/components/forms/slot-demand";

const MODULE_OPTIONS = Array.from({ length: 6 }, (_, i) => ({ value: String(i + 1), label: `Module ${i + 1}` }));
const MARKS_OPTIONS = [2, 5, 10].map((m) => ({ value: String(m), label: `${m} Marks` }));
const CO_OPTIONS = ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"].map((c) => ({ value: c, label: c }));
const RBT_OPTIONS = ["L1", "L2", "L3", "L4", "L5", "L6"].map((l) => ({ value: l, label: l }));
const DIFFICULTY_OPTIONS = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
];

type QuestionFormProps = {
  initialValues?: {
    subjectVersionId?: string;
    moduleNumber?: number;
    marks?: number;
    questionText?: string;
    coMapping?: string;
    rbtLevel?: string;
    difficultyLevel?: string;
    teachingIndex?: string;
  };
  subjectVersions: Array<{ id: string; title: string; subject: { subjectCode: string; subjectName: string } }>;
  endpoint: string;
  title: string;
  bankId?: string;
  method?: "POST" | "PATCH";
  redirectOnSuccess?: string;
  submitAfterSave?: boolean;
  submitEndpoint?: string;
  slotDataMap?: Record<string, SlotInfo[]>;
};

export function QuestionForm({ initialValues, subjectVersions, endpoint, title, bankId, method = "POST", redirectOnSuccess, submitAfterSave, submitEndpoint, slotDataMap }: QuestionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    subjectVersionId: initialValues?.subjectVersionId ?? "",
    moduleNumber: String(initialValues?.moduleNumber ?? ""),
    marks: String(initialValues?.marks ?? ""),
    questionText: initialValues?.questionText ?? "",
    coMapping: initialValues?.coMapping ?? "",
    rbtLevel: initialValues?.rbtLevel ?? "",
    difficultyLevel: initialValues?.difficultyLevel ?? "",
    teachingIndex: initialValues?.teachingIndex ?? "",
  });

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function save(body: Record<string, unknown>, submitAfter: boolean) {
    const url = bankId ? `${endpoint}?bankId=${bankId}` : endpoint;
    const response = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error?.message ?? "Failed to save question");
    }
    const savedId = result.data?.id;
    if (submitAfter && savedId && submitEndpoint) {
      const submitUrl = `${submitEndpoint}/${savedId}?action=submit`;
      const submitResponse = await apiFetch(submitUrl, { method: "POST" });
      const submitResult = await submitResponse.json();
      if (!submitResponse.ok || !submitResult.success) {
        throw new Error(submitResult.error?.message ?? "Failed to submit question");
      }
    }
    return savedId;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const body: Record<string, unknown> = {
      subjectVersionId: values.subjectVersionId,
      moduleNumber: Number(values.moduleNumber),
      marks: Number(values.marks),
      questionText: values.questionText,
      coMapping: values.coMapping,
      rbtLevel: values.rbtLevel,
    };
    if (values.difficultyLevel) body.difficultyLevel = values.difficultyLevel;
    if (values.teachingIndex) body.teachingIndex = values.teachingIndex;

    try {
      await save(body, false);
      toast.success(redirectOnSuccess ? "Question created" : title);
      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
        router.refresh();
      } else {
        setValues({
          subjectVersionId: "",
          moduleNumber: "",
          marks: "",
          questionText: "",
          coMapping: "",
          rbtLevel: "",
          difficultyLevel: "",
          teachingIndex: "",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save question");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndSubmit() {
    setSaving(true);
    const body: Record<string, unknown> = {
      subjectVersionId: values.subjectVersionId,
      moduleNumber: Number(values.moduleNumber),
      marks: Number(values.marks),
      questionText: values.questionText,
      coMapping: values.coMapping,
      rbtLevel: values.rbtLevel,
    };
    if (values.difficultyLevel) body.difficultyLevel = values.difficultyLevel;
    if (values.teachingIndex) body.teachingIndex = values.teachingIndex;

    try {
      await save(body, true);
      toast.success("Question saved and submitted for moderation");
      if (redirectOnSuccess) {
        router.push(redirectOnSuccess);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save and submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subjectVersionId">Subject Version</Label>
            <Select id="subjectVersionId" value={values.subjectVersionId} onChange={(e) => setField("subjectVersionId", e.target.value)} required>
              <option value="">Select</option>
              {subjectVersions.map((sv) => (
                <option key={sv.id} value={sv.id}>{sv.subject.subjectCode} - {sv.title}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="moduleNumber">Module</Label>
              <Select id="moduleNumber" value={values.moduleNumber} onChange={(e) => setField("moduleNumber", e.target.value)} required>
                <option value="">Select</option>
                {MODULE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="marks">Marks</Label>
              <Select id="marks" value={values.marks} onChange={(e) => setField("marks", e.target.value)} required>
                <option value="">Select</option>
                {MARKS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
          </div>
          {slotDataMap && values.subjectVersionId && slotDataMap[values.subjectVersionId] && (
            <SlotDemand
              slots={slotDataMap[values.subjectVersionId]}
              selectedModule={values.moduleNumber}
              selectedMarks={values.marks}
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="questionText">Question Text</Label>
            <Textarea id="questionText" value={values.questionText} onChange={(e) => setField("questionText", e.target.value)} rows={4} required placeholder="Enter your question (minimum 15 characters)" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="coMapping">Course Outcome</Label>
              <Select id="coMapping" value={values.coMapping} onChange={(e) => setField("coMapping", e.target.value)} required>
                <option value="">Select</option>
                {CO_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rbtLevel">RBT Level</Label>
              <Select id="rbtLevel" value={values.rbtLevel} onChange={(e) => setField("rbtLevel", e.target.value)} required>
                <option value="">Select</option>
                {RBT_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficultyLevel">Difficulty (optional)</Label>
              <Select id="difficultyLevel" value={values.difficultyLevel} onChange={(e) => setField("difficultyLevel", e.target.value)}>
                <option value="">Default</option>
                {DIFFICULTY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="teachingIndex">Teaching Index (optional)</Label>
            <Input id="teachingIndex" value={values.teachingIndex} onChange={(e) => setField("teachingIndex", e.target.value)} maxLength={50} placeholder="e.g. L1T1" />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={loading || saving} className="flex-1">
              {loading ? "Saving..." : submitAfterSave ? "Save Question" : "Save Question"}
            </Button>
            {submitAfterSave && (
              <Button type="button" variant="secondary" disabled={loading || saving} className="flex-1" onClick={handleSaveAndSubmit}>
                {saving ? "Saving & Submitting..." : "Save & Submit"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
