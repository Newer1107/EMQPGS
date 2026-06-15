"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";

type LinkCycleFormProps = {
  subjectId: string;
  examCycles: Array<{ id: string; examType: string; semester: { name: string }; academicYear: { code: string } }>;
  existingLinks: Array<{ examCycleId: string }>;
};

export function LinkCycleForm({ subjectId, examCycles, existingLinks }: LinkCycleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [examCycleId, setExamCycleId] = useState("");

  const available = examCycles.filter((ec) => !existingLinks.some((l) => l.examCycleId === ec.id));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch(`/api/subjects/${subjectId}/link-cycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examCycleId }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Subject linked to exam cycle");
        setExamCycleId("");
        router.refresh();
      } else {
        toast.error(result.error?.message ?? "Failed to link");
      }
    } catch {
      toast.error("Network request failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (available.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Link to Exam Cycle</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted-foreground)]">No unlinked exam cycles available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link to Exam Cycle</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="examCycleId">Exam Cycle</Label>
            <Select id="examCycleId" value={examCycleId} onChange={(e) => setExamCycleId(e.target.value)} required>
              <option value="">Select</option>
              {available.map((ec) => (
                <option key={ec.id} value={ec.id}>{ec.examType} - {ec.semester.name} ({ec.academicYear.code})</option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Linking..." : "Link Subject to Cycle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
