"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";

type PlacementFormProps = {
  subjectId: string;
  schemes: Array<{ id: string; label: string }>;
  departments: Array<{ id: string; name: string; code: string }>;
  semesters: number[];
};

const GROUP_OPTIONS = [
  { value: "ALL", label: "All Groups (Core)" },
  { value: "GROUP_1", label: "Group 1" },
  { value: "GROUP_2", label: "Group 2" },
];

export function PlacementForm({ subjectId, schemes, departments, semesters }: PlacementFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [schemeId, setSchemeId] = useState("");
  const [semester, setSemester] = useState("");
  const [departmentId, setDepartmentId] = useState(departments.length > 0 ? departments[0].id : "");
  const [group, setGroup] = useState("ALL");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!schemeId || !semester) {
      toast.error("Select a curriculum scheme and semester.");
      return;
    }
    setLoading(true);

    try {
      const response = await apiFetch("/api/curriculum-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculumSchemeId: schemeId,
          subjectId,
          semesterNumber: Number(semester),
          departmentId: departmentId,
          groupAssignment: group,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Subject placed in curriculum successfully.");
        router.push(`/dashboard/coordinator/subjects/${subjectId}`);
        router.refresh();
      } else {
        toast.error(result.error?.message ?? "Failed to place subject in curriculum.");
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
        <CardTitle>Curriculum Placement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schemeId">Curriculum Scheme</Label>
            <Select id="schemeId" value={schemeId} onChange={(e) => setSchemeId(e.target.value)} required>
              <option value="">Select a scheme</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="semester">Semester</Label>
            <Select id="semester" value={semester} onChange={(e) => setSemester(e.target.value)} required>
              <option value="">Select semester</option>
              {semesters.map((n) => (
                <option key={n} value={n}>Semester {n}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="departmentId">Department</Label>
            <Select id="departmentId" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group">Group Assignment</Label>
            <Select id="group" value={group} onChange={(e) => setGroup(e.target.value)}>
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Placing..." : "Place in Curriculum"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/coordinator/subjects/${subjectId}`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
