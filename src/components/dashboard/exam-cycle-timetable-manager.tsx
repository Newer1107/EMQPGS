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

type AcademicYearOption = {
  id: string;
  code: string;
  
};

type SemesterOption = {
  id: string;
  number: number;
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
  academicYearId: string;
  semesterId: string;
  academicYear: AcademicYearOption;
  semester: SemesterOption;
  examType: ExamType;
  status: ExamCycleStatus;
  departmentId: string;
  department?: { id: string; name: string } | null;
  timetableDocumentRef: string | null;
  timetableIssueDate: string | Date | null;
  timetableTitle: string | null;
  timetableRows: unknown;
  timetableSignature: string | null;
};

type FormState = {
  academicYearId: string;
  semesterId: string;
  examType: ExamType;
  status: ExamCycleStatus;
  departmentId: string;
  timetableDocumentRef: string;
  timetableIssueDate: string;
  timetableTitle: string;
  timetableSignature: string;
  timetableRows: TimetableRow[];
};

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
    academicYearId: "",
    semesterId: "",
    examType: "ENDSEM",
    status: "DRAFT",
    departmentId: "",
    timetableDocumentRef: "TCET/EXAM/ ___ of 2026",
    timetableIssueDate: "",
    timetableTitle: "END SEMESTER EXAMINATIONS (Regular Students) MAY 2026",
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
    academicYearId: cycle.academicYearId,
    semesterId: cycle.semesterId,
    examType: cycle.examType,
    status: cycle.status,
    departmentId: cycle.departmentId,
    timetableDocumentRef: cycle.timetableDocumentRef ?? "TCET/EXAM/ ___ of 2026",
    timetableIssueDate: toDateInputValue(cycle.timetableIssueDate),
    timetableTitle: cycle.timetableTitle ?? "",
    timetableSignature: cycle.timetableSignature ?? "Controller of Examinations",
    timetableRows: normalizeRows(cycle.timetableRows),
  };
}

export function ExamCycleTimetableManager({
  departments,
  academicYears,
  initialCycles,
}: {
  departments: DepartmentOption[];
  academicYears: AcademicYearOption[];
  initialCycles: StoredExamCycle[];
}) {
  const [cycles, setCycles] = useState(initialCycles);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [nextRowId, setNextRowId] = useState(2);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>(buildInitialState());
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId],
  );

  const filteredSemesters = useMemo(
    () => semesters.filter((s) => s.id === form.semesterId || !form.academicYearId || semesters.find((sem) => sem.id === s.id)),
    [semesters, form.semesterId, form.academicYearId],
  );

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function loadSemesters(academicYearId: string): Promise<SemesterOption[]> {
    if (!academicYearId) {
      setSemesters([]);
      return [];
    }
    try {
      const response = await fetch(`/api/semesters?academicYearId=${academicYearId}`);
      const result = await response.json();
      if (result.success) {
        setSemesters(result.data);
        return result.data;
      }
    } catch {
      // silently fail
    }
    return [];
  }

  async function handleAcademicYearChange(value: string) {
    updateField("academicYearId", value);
    updateField("semesterId", "");
    const loaded = await loadSemesters(value);
    const ay = academicYears.find((a) => a.id === value);
    if (loaded.length > 0) {
      const first = loaded[0];
      if (first) updateField("semesterId", first.id);
    }
  }

  function editCycle(cycle: StoredExamCycle) {
    setSelectedCycleId(cycle.id);
    setForm(mapCycleToForm(cycle));
    loadSemesters(cycle.academicYearId);
  }

  function resetForm() {
    setSelectedCycleId(null);
    setForm(buildInitialState());
    setSemesters([]);
  }

  function addRow() {
    setForm((current) => ({
      ...current,
      timetableRows: [...current.timetableRows, createEmptyRow(nextRowId)],
    }));
    setNextRowId((current) => current + 1);
  }

  function deleteRow(index: number) {
    if (form.timetableRows.length <= 1) return;
    setForm((current) => ({
      ...current,
      timetableRows: current.timetableRows.filter((_, i) => i !== index),
    }));
  }

  function updateRow(index: number, field: keyof TimetableRow, value: string) {
    setForm((current) => ({
      ...current,
      timetableRows: current.timetableRows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  }

  async function onSave() {
    setIsSaving(true);

    const payload: Record<string, unknown> = {
      academicYearId: form.academicYearId,
      semesterId: form.semesterId,
      examType: form.examType,
      status: form.status,
      departmentId: form.departmentId,
      timetableDocumentRef: form.timetableDocumentRef,
      timetableIssueDate: form.timetableIssueDate,
      timetableTitle: form.timetableTitle,
      timetableRows: form.timetableRows.map(({ id: _id, ...rest }) => rest),
      timetableSignature: form.timetableSignature,
    };

    try {
      const isEdit = selectedCycleId !== null;
      const endpoint = isEdit ? `/api/exam-cycles/${selectedCycleId}` : "/api/exam-cycles";
      const method = isEdit ? "PATCH" : "POST";

      const response = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const updatedCycle = {
          ...result.data,
          academicYear: form.academicYearId
            ? academicYears.find((ay) => ay.id === form.academicYearId) ?? { id: form.academicYearId, code: "" }
            : { id: "", code: "" },
          semester: form.semesterId
            ? semesters.find((s) => s.id === form.semesterId) ?? { id: form.semesterId, number: 0, name: "" }
            : { id: "", number: 0, name: "" },
        };

        if (isEdit) {
          setCycles((current) => current.map((cycle) => (cycle.id === selectedCycleId ? { ...cycle, ...updatedCycle } : cycle)));
        } else {
          setCycles((current) => [updatedCycle, ...current]);
        }

        resetForm();
        toast.success(isEdit ? "Exam cycle updated." : "Exam cycle created.");
      } else {
        toast.error(result.error?.message ?? "Failed to save exam cycle.");
      }
    } catch {
      toast.error("Network request failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create / Edit Exam Cycle</CardTitle>
          <CardDescription>Configure exam cycle details and timetable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="academic-year" className="text-sm font-medium">Academic Year</label>
              <Select
                id="academic-year"
                value={form.academicYearId}
                onChange={(event) => handleAcademicYearChange(event.target.value)}
              >
                <option value="">Select academic year...</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>{year.code}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="semester" className="text-sm font-medium">Semester</label>
              <Select
                id="semester"
                value={form.semesterId}
                onChange={(event) => updateField("semesterId", event.target.value)}
                disabled={!form.academicYearId}
              >
                <option value="">Select semester...</option>
                {semesters.map((sem) => (
                  <option key={sem.id} value={sem.id}>{sem.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="exam-type" className="text-sm font-medium">Exam Type</label>
              <Select
                id="exam-type"
                value={form.examType}
                onChange={(event) => updateField("examType", event.target.value as ExamType)}
              >
                {examTypeOptions.map((type) => (
                  <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="cycle-status" className="text-sm font-medium">Status</label>
              <Select
                id="cycle-status"
                value={form.status}
                onChange={(event) => updateField("status", event.target.value as ExamCycleStatus)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="cycle-department" className="text-sm font-medium">Department</label>
            <Select
              id="cycle-department"
              value={form.departmentId}
              onChange={(event) => updateField("departmentId", event.target.value)}
            >
              <option value="">Select a department...</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="timetable-ref" className="text-sm font-medium">Timetable Document Reference</label>
            <Input id="timetable-ref" value={form.timetableDocumentRef} onChange={(event) => updateField("timetableDocumentRef", event.target.value)} />
          </div>

          <div className="space-y-2">
            <label htmlFor="issue-date" className="text-sm font-medium">Timetable Issue Date</label>
            <Input id="issue-date" type="date" value={form.timetableIssueDate} onChange={(event) => updateField("timetableIssueDate", event.target.value)} />
          </div>

          <div className="space-y-2">
            <label htmlFor="timetable-title" className="text-sm font-medium">Timetable Title</label>
            <Input id="timetable-title" value={form.timetableTitle} onChange={(event) => updateField("timetableTitle", event.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Timetable Rows</label>
            {form.timetableRows.map((row, index) => (
              <div key={row.id} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Input placeholder="Date / Day" value={row.dateDay} onChange={(event) => updateRow(index, "dateDay", event.target.value)} />
                </div>
                <div className="flex-1">
                  <Input placeholder="Time" value={row.time} onChange={(event) => updateRow(index, "time", event.target.value)} />
                </div>
                <div className="flex-1">
                  <Input placeholder="Paper" value={row.paper} onChange={(event) => updateRow(index, "paper", event.target.value)} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => deleteRow(index)} disabled={form.timetableRows.length <= 1}>×</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addRow}>+ Add Row</Button>
          </div>

          <div className="space-y-2">
            <label htmlFor="timetable-signature" className="text-sm font-medium">Signature</label>
            <Textarea id="timetable-signature" value={form.timetableSignature} onChange={(event) => updateField("timetableSignature", event.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={onSave} disabled={isSaving || !form.academicYearId || !form.semesterId}>
              {isSaving ? "Saving..." : selectedCycleId ? "Update Cycle" : "Create Cycle"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>New Cycle Form</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stored Exam Cycles</CardTitle>
          <CardDescription>Saved cycles ({cycles.length}). Click a row to edit.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-2 py-1">Academic Year</th>
                  <th className="text-left px-2 py-1">Semester</th>
                  <th className="text-left px-2 py-1">Exam Type</th>
                  <th className="text-left px-2 py-1">Status</th>
                  <th className="text-left px-2 py-1">Department</th>
                  <th className="text-left px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((cycle) => (
                  <tr key={cycle.id} className="border-b hover:bg-[var(--surface-hover)]">
                    <td className="px-2 py-1">{cycle.academicYear.code}</td>
                    <td className="px-2 py-1">{cycle.semester.name}</td>
                    <td className="px-2 py-1">{cycle.examType}</td>
                    <td className="px-2 py-1">{cycle.status}</td>
                    <td className="px-2 py-1">{cycle.department?.name ?? ""}</td>
                    <td className="px-2 py-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => editCycle(cycle)}>
                        Edit Stored Cycle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
