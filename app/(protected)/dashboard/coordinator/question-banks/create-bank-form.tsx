"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client-fetch";
import { feedback } from "@/lib/feedback";
import { useRouter } from "next/navigation";
import type { ExamType } from "@prisma/client";

type Subject = { id: string; subjectCode: string; subjectName: string; examCycleLinks: Array<{ examCycleId: string }> };
type ExamCycle = { id: string; examType: ExamType; batchSemester: { semesterNumber: number; academicYear: { code: string } } };

export function CreateBankForm({ subjects, examCycles: cycles }: { subjects: Subject[]; examCycles: ExamCycle[] }) {
  const router = useRouter();
  const [examCycleId, setExamCycleId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(false);

  const linked = examCycleId
    ? subjects.filter((s) => s.examCycleLinks.some((l) => l.examCycleId === examCycleId))
    : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!examCycleId || !subjectId) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/question-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, examCycleId }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        feedback.success({ title: "Question bank created" });
        setExamCycleId("");
        setSubjectId("");
        router.refresh();
      } else {
        feedback.error(result.error?.message ?? "Failed to create question bank");
      }
    } catch {
      feedback.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Question Bank</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="examCycle">Exam Cycle</Label>
            <Select id="examCycle" value={examCycleId} onChange={(e) => { setExamCycleId(e.target.value); setSubjectId(""); }}>
              <option value="">Select an exam cycle...</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  Sem {c.batchSemester.semesterNumber} · {c.batchSemester.academicYear.code} / {c.examType}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Select id="subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!examCycleId}>
              <option value="">{examCycleId ? linked.length === 0 ? "No subjects linked to this cycle" : "Select a subject..." : "Select an exam cycle first"}</option>
              {linked.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subjectCode} - {s.subjectName}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={!examCycleId || !subjectId || loading} className="w-full">
            {loading ? "Creating..." : "Create Question Bank"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
