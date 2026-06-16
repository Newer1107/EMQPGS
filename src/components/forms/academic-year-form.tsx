"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client-fetch";

export function AcademicYearForm() {
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({ code: "", startDate: "", endDate: "", activeSemesterType: "ODD" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: values.code,
          startDate: values.startDate,
          endDate: values.endDate,
          activeSemesterType: values.activeSemesterType,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Academic year created");
        setValues({ code: "", startDate: "", endDate: "", activeSemesterType: "ODD" });
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
        <CardTitle>Create Academic Year</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Academic Year Code</Label>
            <Input id="code" value={values.code} onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))} required placeholder="e.g. 2025-2026" pattern="\d{4}-\d{4}" />
            <p className="text-xs text-[var(--muted-foreground)]">Format: YYYY-YYYY (e.g. 2025-2026)</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={values.startDate} onChange={(e) => setValues((v) => ({ ...v, startDate: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={values.endDate} onChange={(e) => setValues((v) => ({ ...v, endDate: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activeSemesterType">Active Semester Type</Label>
            <select
              id="activeSemesterType"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={values.activeSemesterType}
              onChange={(e) => setValues((v) => ({ ...v, activeSemesterType: e.target.value }))}
            >
              <option value="ODD">ODD (Sem 1,3,5,7)</option>
              <option value="EVEN">EVEN (Sem 2,4,6,8)</option>
            </select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Academic Year"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
