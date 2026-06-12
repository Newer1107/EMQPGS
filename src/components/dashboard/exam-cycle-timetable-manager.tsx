"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";

type ExamType = "ISE_1" | "ISE_2" | "ENDSEM" | "SUPPLEMENTARY" | "KT";
type ExamCycleStatus = "DRAFT" | "ACTIVE" | "CLOSED";

type DepartmentOption = {
  id: string;
  name: string;
};

type TimetableRow = {
  id: string;
  dateDay: string;
  time: string;
  paper: string;
};

type StoredExamCycle = {
  id: string;
  academicYear: string;
  semester: number;
  examType: ExamType;
  status: ExamCycleStatus;
  departmentId: string | null;
  timetableDocumentRef: string | null;
  timetableIssueDate: string | Date | null;
  timetableTitle: string | null;
  timetableBranch: string | null;
  timetableRows: unknown;
  timetableSignature: string | null;
};

type FormState = {
  academicYear: string;
  semester: string;
  examType: ExamType;
  status: ExamCycleStatus;
  departmentId: string;
  timetableDocumentRef: string;
  timetableIssueDate: string;
  timetableTitle: string;
  timetableBranch: string;
  timetableSignature: string;
  timetableRows: TimetableRow[];
};

const semesterOptions = [
  { value: "1", label: "Semester I" },
  { value: "2", label: "Semester II" },
  { value: "3", label: "Semester III" },
  { value: "4", label: "Semester IV" },
  { value: "5", label: "Semester V" },
  { value: "6", label: "Semester VI" },
  { value: "7", label: "Semester VII" },
  { value: "8", label: "Semester VIII" },
] as const;

const examTypeOptions: ExamType[] = ["ISE_1", "ISE_2", "ENDSEM", "SUPPLEMENTARY", "KT"];
const statusOptions: ExamCycleStatus[] = ["DRAFT", "ACTIVE", "CLOSED"];

function createEmptyRow(id: number): TimetableRow {
  return {
    id: `row-${id}`,
    dateDay: "",
    time: "",
    paper: "",
  };
}

function toDateInputValue(value: string | Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeRows(value: unknown): TimetableRow[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [createEmptyRow(1)];
  }

  return value.map((row, index) => {
    const record = typeof row === "object" && row !== null ? row as Record<string, unknown> : {};
    return {
      id: `row-${index + 1}`,
      dateDay: typeof record.dateDay === "string" ? record.dateDay : "",
      time: typeof record.time === "string" ? record.time : "",
      paper: typeof record.paper === "string" ? record.paper : "",
    };
  });
}

function buildInitialState(): FormState {
  return {
    academicYear: "2026-2027",
    semester: "1",
    examType: "ENDSEM",
    status: "DRAFT",
    departmentId: "",
    timetableDocumentRef: "TCET/EXAM/ ___ of 2026",
    timetableIssueDate: "",
    timetableTitle: "END SEMESTER EXAMINATIONS (Regular Students) MAY 2026",
    timetableBranch: "Computer Engineering",
    timetableSignature: "Controller of Examinations",
    timetableRows: [
      {
        id: "row-1",
        dateDay: "19/05/2026 Tuesday",
        time: "10.30 am to 12.30 pm",
        paper: "Mathematics - IV",
      },
    ],
  };
}

function mapCycleToForm(cycle: StoredExamCycle): FormState {
  return {
    academicYear: cycle.academicYear,
    semester: String(cycle.semester),
    examType: cycle.examType,
    status: cycle.status,
    departmentId: cycle.departmentId ?? "",
    timetableDocumentRef: cycle.timetableDocumentRef ?? "TCET/EXAM/ ___ of 2026",
    timetableIssueDate: toDateInputValue(cycle.timetableIssueDate),
    timetableTitle: cycle.timetableTitle ?? "",
    timetableBranch: cycle.timetableBranch ?? "",
    timetableSignature: cycle.timetableSignature ?? "Controller of Examinations",
    timetableRows: normalizeRows(cycle.timetableRows),
  };
}

export function ExamCycleTimetableManager({
  departments,
  initialCycles,
}: {
  departments: DepartmentOption[];
  initialCycles: StoredExamCycle[];
}) {
  const [cycles, setCycles] = useState(initialCycles);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [nextRowId, setNextRowId] = useState(2);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>(buildInitialState());

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId],
  );

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateRow(id: string, field: keyof Omit<TimetableRow, "id">, value: string) {
    setForm((current) => ({
      ...current,
      timetableRows: current.timetableRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    }));
  }

  function addRow() {
    setForm((current) => ({
      ...current,
      timetableRows: [...current.timetableRows, createEmptyRow(nextRowId)],
    }));
    setNextRowId((current) => current + 1);
  }

  function deleteRow(id: string) {
    setForm((current) => ({
      ...current,
      timetableRows: current.timetableRows.length === 1
        ? current.timetableRows
        : current.timetableRows.filter((row) => row.id !== id),
    }));
  }

  function resetForm() {
    setSelectedCycleId(null);
    setForm(buildInitialState());
    setNextRowId(2);
  }

  function editCycle(cycle: StoredExamCycle) {
    const nextForm = mapCycleToForm(cycle);
    setSelectedCycleId(cycle.id);
    setForm(nextForm);
    setNextRowId(nextForm.timetableRows.length + 1);
  }

  async function submitForm() {
    setIsSaving(true);

    const payload = {
      academicYear: form.academicYear,
      semester: Number(form.semester),
      examType: form.examType,
      status: form.status,
      departmentId: form.departmentId || null,
      timetableDocumentRef: form.timetableDocumentRef,
      timetableIssueDate: form.timetableIssueDate,
      timetableTitle: form.timetableTitle,
      timetableBranch: form.timetableBranch,
      timetableSignature: form.timetableSignature,
      timetableRows: form.timetableRows.map(({ dateDay, time, paper }) => ({ dateDay, time, paper })),
    };

    const endpoint = selectedCycleId ? `/api/exam-cycles/${selectedCycleId}` : "/api/exam-cycles";
    const method = selectedCycleId ? "PATCH" : "POST";

    const response = await apiFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error?.message ?? "Failed to save examination cycle");
      return;
    }

    const savedCycle = result.data as StoredExamCycle;
    setCycles((current) => {
      if (selectedCycleId) {
        return current.map((cycle) => (cycle.id === savedCycle.id ? savedCycle : cycle));
      }
      return [savedCycle, ...current];
    });

    toast.success(selectedCycleId ? "Examination cycle updated" : "Examination cycle created");
    editCycle(savedCycle);
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <p className="page-kicker">COE</p>
          <CardTitle className="mt-2 text-4xl">Examination Time Table</CardTitle>
          <CardDescription className="mt-3 max-w-4xl text-base">
            Build and store timetable sheets directly against examination-cycle records. Every header field and every table row below is saved in the database.
          </CardDescription>
        </CardHeader>

        <form
          className="space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            void submitForm();
          }}
        >
          <CardContent className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="timetable-document-ref">
                  Document Ref No.
                </label>
                <Input
                  id="timetable-document-ref"
                  value={form.timetableDocumentRef}
                  onChange={(event) => updateField("timetableDocumentRef", event.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="timetable-issue-date">
                  Date
                </label>
                <Input
                  id="timetable-issue-date"
                  type="date"
                  value={form.timetableIssueDate}
                  onChange={(event) => updateField("timetableIssueDate", event.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-medium" htmlFor="timetable-title">
                  Examination Cycle Title
                </label>
                <Input
                  id="timetable-title"
                  value={form.timetableTitle}
                  onChange={(event) => updateField("timetableTitle", event.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="timetable-branch">
                  Branch
                </label>
                <Input
                  id="timetable-branch"
                  value={form.timetableBranch}
                  onChange={(event) => updateField("timetableBranch", event.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="semester">
                  Semester
                </label>
                <Select
                  id="semester"
                  value={form.semester}
                  onChange={(event) => updateField("semester", event.target.value)}
                  className="h-11 bg-white font-medium"
                >
                  {semesterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="academic-year">
                  Academic Year
                </label>
                <Input
                  id="academic-year"
                  value={form.academicYear}
                  onChange={(event) => updateField("academicYear", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="exam-type">
                  Exam Type
                </label>
                <Select
                  id="exam-type"
                  value={form.examType}
                  onChange={(event) => updateField("examType", event.target.value as ExamType)}
                >
                  {examTypeOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="cycle-status">
                  Status
                </label>
                <Select
                  id="cycle-status"
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value as ExamCycleStatus)}
                >
                  {statusOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="department-id">
                  Department Link
                </label>
                <Select
                  id="department-id"
                  value={form.departmentId}
                  onChange={(event) => updateField("departmentId", event.target.value)}
                >
                  <option value="">No linked department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-black bg-white">
              <table className="min-w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.22em]">Date &amp; Day</th>
                    <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.22em]">Time</th>
                    <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.22em]">Paper</th>
                    <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.22em]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {form.timetableRows.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-[#fbf8f1]"}>
                      <td className="border border-black p-0">
                        <Input
                          value={row.dateDay}
                          onChange={(event) => updateRow(row.id, "dateDay", event.target.value)}
                          placeholder="19/05/2026 Tuesday"
                          className="h-16 rounded-none border-0 px-4 text-sm shadow-none focus-visible:border-0"
                        />
                      </td>
                      <td className="border border-black p-0">
                        <Input
                          value={row.time}
                          onChange={(event) => updateRow(row.id, "time", event.target.value)}
                          placeholder="10.30 am to 12.30 pm"
                          className="h-16 rounded-none border-0 px-4 text-sm shadow-none focus-visible:border-0"
                        />
                      </td>
                      <td className="border border-black p-0">
                        <Input
                          value={row.paper}
                          onChange={(event) => updateRow(row.id, "paper", event.target.value)}
                          placeholder="Mathematics - IV"
                          className="h-16 rounded-none border-0 px-4 text-sm shadow-none focus-visible:border-0"
                        />
                      </td>
                      <td className="border border-black px-3 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => deleteRow(row.id)}
                          disabled={form.timetableRows.length === 1}
                          className="w-full"
                        >
                          Delete Row
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={addRow}>
                + Add Row
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                New Cycle Form
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedCycle ? "Update Cycle" : "Save Cycle"}
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-4">
                <p className="text-sm font-medium text-[var(--muted-foreground)]">Document Preview</p>
                <div className="space-y-2">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{form.timetableDocumentRef}</p>
                  <p className="text-xl font-semibold uppercase">{form.timetableTitle}</p>
                  <p className="text-sm uppercase tracking-[0.12em]">
                    {form.timetableBranch} | {semesterOptions.find((option) => option.value === form.semester)?.label}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">{form.timetableIssueDate || "Select the issue date"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="timetable-signature">
                  Signature Block
                </label>
                <Textarea
                  id="timetable-signature"
                  value={form.timetableSignature}
                  onChange={(event) => updateField("timetableSignature", event.target.value)}
                  className="min-h-32 text-right text-base"
                />
              </div>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Examination Cycles</CardTitle>
          <CardDescription>Open any saved record to continue editing the persisted timetable data.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-[var(--muted)]">
                  <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.18em]">Title</th>
                  <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.18em]">Branch</th>
                  <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.18em]">Semester</th>
                  <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.18em]">Date</th>
                  <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.18em]">Rows</th>
                  <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.18em]">Status</th>
                  <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.18em]">Action</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((cycle) => (
                  <tr key={cycle.id}>
                    <td className="border border-black px-4 py-3 text-sm font-medium">{cycle.timetableTitle || "Untitled cycle"}</td>
                    <td className="border border-black px-4 py-3 text-sm">{cycle.timetableBranch || "-"}</td>
                    <td className="border border-black px-4 py-3 text-sm">
                      {semesterOptions.find((option) => option.value === String(cycle.semester))?.label ?? `Semester ${cycle.semester}`}
                    </td>
                    <td className="border border-black px-4 py-3 text-sm">{toDateInputValue(cycle.timetableIssueDate) || "-"}</td>
                    <td className="border border-black px-4 py-3 text-sm">{normalizeRows(cycle.timetableRows).length}</td>
                    <td className="border border-black px-4 py-3 text-sm">{cycle.status}</td>
                    <td className="border border-black px-4 py-3">
                      <Button type="button" size="sm" onClick={() => editCycle(cycle)}>Edit Stored Cycle</Button>
                    </td>
                  </tr>
                ))}
                {cycles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-black px-4 py-8 text-center text-sm text-neutral-600">
                      No examination cycles have been saved yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
