"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";

type SubjectVersionFormProps = {
  subjectId: string;
  academicYears: Array<{ id: string; code: string }>;
};

export function SubjectVersionForm({ subjectId, academicYears }: SubjectVersionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({ title: "", syllabusDescription: "", effectiveFromAcademicYearId: "" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch("/api/subject-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          title: values.title,
          syllabusDescription: values.syllabusDescription || undefined,
          effectiveFromAcademicYearId: values.effectiveFromAcademicYearId,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        feedback.success({ title: "Subject version created", description: "A new draft version is ready for editing" });
        setValues({ title: "", syllabusDescription: "", effectiveFromAcademicYearId: "" });
        router.refresh();
      } else {
        console.error("[SubjectVersionForm]", result.error ?? result);
        feedback.error(result.error?.message ?? "Could not create subject version");
      }
    } catch (error) {
      console.error("[SubjectVersionForm]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Version</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Version Title</Label>
            <Input id="title" value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} required placeholder="e.g. 2025-2026 Syllabus" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="effectiveFromAcademicYearId">Effective From</Label>
            <Select id="effectiveFromAcademicYearId" value={values.effectiveFromAcademicYearId} onChange={(e) => setValues((v) => ({ ...v, effectiveFromAcademicYearId: e.target.value }))} required>
              <option value="">Select</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.code}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="syllabusDescription">Syllabus Description (optional)</Label>
            <Textarea id="syllabusDescription" value={values.syllabusDescription} onChange={(e) => setValues((v) => ({ ...v, syllabusDescription: e.target.value }))} rows={3} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Version"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
