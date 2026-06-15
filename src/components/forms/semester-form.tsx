"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";

type SemesterFormProps = {
  academicYears: Array<{ id: string; code: string }>;
};

export function SemesterForm({ academicYears }: SemesterFormProps) {
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({ number: "", name: "", academicYearId: "" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch("/api/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: Number(values.number),
          name: values.name,
          academicYearId: values.academicYearId,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Semester created");
        setValues({ number: "", name: "", academicYearId: "" });
      } else {
        toast.error(result.error?.message ?? "Failed to create");
      }
    } catch {
      toast.error("Network request failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Semester</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="number">Semester Number</Label>
              <Input id="number" type="number" min={1} max={8} value={values.number} onChange={(e) => setValues((v) => ({ ...v, number: e.target.value }))} required placeholder="1-8" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Semester Name</Label>
              <Input id="name" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required placeholder="e.g. Autumn 2025" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="academicYearId">Academic Year</Label>
            <Select id="academicYearId" value={values.academicYearId} onChange={(e) => setValues((v) => ({ ...v, academicYearId: e.target.value }))} required>
              <option value="">Select</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.code}</option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Semester"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
