"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";

type SubjectFormProps = {
  departments: Array<{ id: string; name: string; code: string }>;
  initialValues?: {
    name?: string;
    code?: string;
    departmentId?: string;
    credits?: number;
  };
  endpoint: string;
  title: string;
};

export function SubjectForm({ departments, initialValues, endpoint, title }: SubjectFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    departmentId: initialValues?.departmentId ?? "",
    credits: String(initialValues?.credits ?? ""),
  });

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const body = {
      name: values.name,
      code: values.code,
      departmentId: values.departmentId,
      credits: Number(values.credits),
    };

    try {
      const response = await apiFetch(endpoint, {
        method: initialValues ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const subjectId = result.data?.id;
        feedback.success({ title: "Subject created. Now place it in a curriculum to make it available for exam cycles." });
        if (subjectId && !initialValues) {
          router.push(`/dashboard/coordinator/subjects/${subjectId}`);
        } else {
          router.push("/dashboard/coordinator/subjects");
        }
        router.refresh();
      } else {
        feedback.error(result.error?.message ?? "Could not save subject");
      }
    } catch (error) {
      console.error("[SubjectForm]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Subject Name</Label>
              <Input id="name" value={values.name} onChange={(e) => setField("name", e.target.value)} required placeholder="e.g. Data Structures" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Subject Code</Label>
              <Input id="code" value={values.code} onChange={(e) => setField("code", e.target.value)} required placeholder="e.g. CS201" maxLength={20} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" value={values.departmentId} onChange={(e) => setField("departmentId", e.target.value)} required>
                <option value="">Select</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits">Credit Load</Label>
              <Input id="credits" type="number" min={1} max={10} value={values.credits} onChange={(e) => setField("credits", e.target.value)} required placeholder="e.g. 4" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : initialValues ? "Update Subject" : "Create Subject"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
