"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";
import { PrerequisiteDialog } from "@/components/forms/prerequisite-dialog";

type SchemeOption = { id: string; name: string; year: number; durationSemesters: number };

type Props = {
  departments: Array<{ id: string; name: string }>;
  schemes: SchemeOption[];
};

type DialogState = {
  missing: string[];
  existing: string[];
  durationSemesters: number;
};

export function BatchForm({ departments, schemes }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [values, setValues] = useState({ name: "", code: "", departmentId: "", curriculumSchemeId: "", admissionYear: "", graduationYear: "" });

  function setField(name: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function buildPayload() {
    return {
      name: values.name,
      code: values.code,
      departmentId: values.departmentId,
      curriculumSchemeId: values.curriculumSchemeId,
      admissionYear: Number(values.admissionYear),
      graduationYear: Number(values.graduationYear),
      hasTeachingGroups: false,
    };
  }

  function handleCreateSuccess(json: { data?: { batch?: { id: string }; academicYearsCreated?: number; allDraft?: boolean } }) {
    const data = json.data;
    if (!data?.batch?.id) {
      feedback.success({ title: "Batch created successfully" });
      router.push("/dashboard/coe/batches");
      router.refresh();
      return;
    }

    if (data.academicYearsCreated && data.academicYearsCreated > 0) {
      const msg = `${data.academicYearsCreated} Academic Year${data.academicYearsCreated !== 1 ? "s were" : " was"} created${data.allDraft ? " in Draft status. Please review their dates before activating them." : "."} Batch created successfully.`;
      feedback.success({ title: msg });
    } else {
      feedback.success({ title: "Batch created successfully" });
    }

    router.push(`/dashboard/coe/batches/${data.batch.id}`);
    router.refresh();
  }

  async function handleCheckAndSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiFetch("/api/batches/check-prerequisites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionYear: Number(values.admissionYear),
          curriculumSchemeId: values.curriculumSchemeId,
        }),
      });
      const json = await res.json();

      if (!res.ok && json.error?.code === "PREREQUISITE_MISSING") {
        setDialog({
          missing: json.error.details.missing,
          existing: json.error.details.existing,
          durationSemesters: json.error.details.durationSemesters,
        });
        return;
      }

      if (!res.ok) {
        feedback.error(json.error?.message ?? "Validation failed");
        return;
      }

      await createBatch();
    } catch {
      feedback.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function createBatch() {
    const res = await apiFetch("/api/batches/create-with-prerequisites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error?.message ?? "Failed to create batch");
    }

    handleCreateSuccess(json);
  }

  async function handleConfirmDialog() {
    setDialog(null);
    setLoading(true);
    try {
      await createBatch();
    } catch (err) {
      feedback.error(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCancelDialog() {
    setDialog(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Create Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCheckAndSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Batch Name</Label>
              <Input id="name" value={values.name} onChange={(e) => setField("name", e.target.value)} required placeholder="e.g. BE CO 2025" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Batch Code</Label>
              <Input id="code" value={values.code} onChange={(e) => setField("code", e.target.value)} required placeholder="e.g. BECO-2025" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" value={values.departmentId} onChange={(e) => setField("departmentId", e.target.value)} required>
                <option value="">Select...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="curriculumSchemeId">Curriculum Scheme</Label>
              <Select id="curriculumSchemeId" value={values.curriculumSchemeId} onChange={(e) => setField("curriculumSchemeId", e.target.value)} required>
                <option value="">Select...</option>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admissionYear">Admission Year</Label>
              <Input id="admissionYear" type="number" value={values.admissionYear} onChange={(e) => setField("admissionYear", e.target.value)} required placeholder="e.g. 2025" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graduationYear">Expected Graduation Year</Label>
              <Input id="graduationYear" type="number" value={values.graduationYear} onChange={(e) => setField("graduationYear", e.target.value)} required placeholder="e.g. 2029" />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating..." : "Create Batch"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {dialog && (
        <PrerequisiteDialog
          missing={dialog.missing}
          existing={dialog.existing}
          durationSemesters={dialog.durationSemesters}
          onConfirm={handleConfirmDialog}
          onCancel={handleCancelDialog}
          loading={loading}
        />
      )}
    </>
  );
}
