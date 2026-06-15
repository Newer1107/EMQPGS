"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";

type CoordinatorDecisionFormProps = {
  questionBankId: string;
};

export function CoordinatorDecisionForm({ questionBankId }: CoordinatorDecisionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState("");
  const [remark, setRemark] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = { decision };
      if (remark.trim()) body.remark = remark.trim();

      const response = await apiFetch(`/api/question-banks/${questionBankId}/coordinator-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Decision recorded");
        router.refresh();
      } else {
        toast.error(result.error?.message ?? "Failed to record decision");
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
        <CardTitle>Coordinator Decision</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="decision">Decision</Label>
            <Select id="decision" value={decision} onChange={(e) => setDecision(e.target.value)} required>
              <option value="">Select</option>
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remark">Remark (optional)</Label>
            <Textarea id="remark" value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={500} rows={2} placeholder="Add a remark..." />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Submitting..." : "Submit Decision"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
