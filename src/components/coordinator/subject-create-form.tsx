"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";

type DepartmentOption = {
  id: string;
  name: string;
};

type Props = {
  departments: DepartmentOption[];
};

type FieldErrors = {
  name?: string;
  code?: string;
  semester?: string;
  credits?: string;
  form?: string;
};

export function SubjectCreateForm({ departments }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    name: "",
    code: "",
    semester: "",
    credits: "",
    departmentId: departments[0]?.id ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const singleDepartment = departments.length === 1;

  function validate() {
    const nextErrors: FieldErrors = {};

    if (!values.name.trim()) nextErrors.name = "Subject name is required.";
    if (!values.code.trim()) nextErrors.code = "Subject code is required.";

    const semester = Number(values.semester);
    if (!values.semester || !Number.isInteger(semester) || semester <= 0) {
      nextErrors.semester = "Semester must be a positive integer.";
    }

    const credits = Number(values.credits);
    if (!values.credits || Number.isNaN(credits) || credits <= 0) {
      nextErrors.credits = "Credits must be a positive number.";
    }

    if (!values.departmentId) {
      nextErrors.form = "Department is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await apiFetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          code: values.code.trim(),
          semester: Number(values.semester),
          credits: Number(values.credits),
          departmentId: values.departmentId,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setOpen(false);
        setValues({
          name: "",
          code: "",
          semester: "",
          credits: "",
          departmentId: departments[0]?.id ?? "",
        });
        toast.success("Subject created successfully.");
        router.refresh();
        return;
      }

      if (response.status === 409) {
        setErrors({ code: "This subject code already exists in this department." });
        return;
      }

      setErrors({ form: result.error?.message ?? "Failed to create subject." });
    } catch {
      setErrors({ form: "Network request failed. Please check your connection." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" onClick={() => setOpen((current) => !current)}>
        {open ? "Cancel Subject Creation" : "Create Subject"}
      </Button>
      {open ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="subject-name">Subject Name</Label>
                <Input
                  id="subject-name"
                  value={values.name}
                  onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                />
                {errors.name ? <p className="text-sm text-red-600">{errors.name}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-code">Subject Code</Label>
                <Input
                  id="subject-code"
                  value={values.code}
                  onChange={(event) => setValues((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                />
                {errors.code ? <p className="text-sm text-red-600">{errors.code}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-semester">Semester</Label>
                <Input
                  id="subject-semester"
                  type="number"
                  min={1}
                  value={values.semester}
                  onChange={(event) => setValues((current) => ({ ...current, semester: event.target.value }))}
                />
                {errors.semester ? <p className="text-sm text-red-600">{errors.semester}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-credits">Credits</Label>
                <Input
                  id="subject-credits"
                  type="number"
                  min={1}
                  step="0.5"
                  value={values.credits}
                  onChange={(event) => setValues((current) => ({ ...current, credits: event.target.value }))}
                />
                {errors.credits ? <p className="text-sm text-red-600">{errors.credits}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-department">Department</Label>
                {singleDepartment ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm">
                    {departments[0]?.name}
                  </div>
                ) : (
                  <Select
                    id="subject-department"
                    value={values.departmentId}
                    onChange={(event) => setValues((current) => ({ ...current, departmentId: event.target.value }))}
                  >
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {errors.form ? <p className="text-sm text-red-600">{errors.form}</p> : null}

              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Subject"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
