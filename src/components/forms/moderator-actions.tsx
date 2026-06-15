"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";

type ModeratorActionsProps = {
  questionId: string;
  status: string;
  queueIds: string[];
};

export function ModeratorActions({ questionId, status, queueIds }: ModeratorActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [instructions, setInstructions] = useState("");

  const actionable = status === "PENDING" || status === "REVISION_SUBMITTED";

  function navigateToNext() {
    const currentIndex = queueIds.indexOf(questionId);
    if (currentIndex >= 0 && currentIndex < queueIds.length - 1) {
      const nextId = queueIds[currentIndex + 1];
      router.push(`/dashboard/moderator/questions/${nextId}`);
    } else {
      router.push("/dashboard/moderator/questions");
    }
  }

  async function handleAction(action: "approve" | "reject" | "request-revision") {
    setLoading(action);
    try {
      let body: Record<string, string> | undefined;
      if (action === "reject") {
        if (!reason.trim()) { toast.error("Please provide a rejection reason"); setLoading(null); return; }
        body = { reason: reason.trim() };
      }
      if (action === "request-revision") {
        if (!instructions.trim()) { toast.error("Please provide revision instructions"); setLoading(null); return; }
        body = { instructions: instructions.trim() };
      }

      const response = await apiFetch(`/api/moderation/questions/${questionId}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const msg = action === "approve" ? "Question approved" : action === "reject" ? "Question rejected" : "Revision requested";
        toast.success(msg);
        setTimeout(navigateToNext, 600);
      } else {
        toast.error(result.error?.message ?? "Action failed");
      }
    } catch {
      toast.error("Network request failed. Please check your connection.");
    } finally {
      setLoading(null);
    }
  }

  if (!actionable) {
    const statusMessages: Record<string, string> = {
      APPROVED: "This question has been approved.",
      REJECTED: "This question has been rejected.",
      REVISION_REQUESTED: "Awaiting revision from the contributor.",
      DRAFT: "This question has not been submitted for review.",
    };
    return (
      <Card>
        <CardHeader><CardTitle>Moderation Actions</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted-foreground)]">{statusMessages[status] ?? `Status: ${status}`}</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/moderator/questions")} className="mt-3 w-full">
            Back to Queue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moderation Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-[var(--muted-foreground)]">
          Question {queueIds.indexOf(questionId) + 1} of {queueIds.length}
        </p>
        <Button variant="default" size="sm" onClick={() => handleAction("approve")} disabled={loading !== null} className="w-full">
          {loading === "approve" ? "Approving..." : "Approve Question"}
        </Button>

        <div className="space-y-2">
          <Label htmlFor="reason">Rejection Reason</Label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Enter the reason for rejection..." />
          <Button variant="danger" size="sm" onClick={() => handleAction("reject")} disabled={loading !== null} className="w-full">
            {loading === "reject" ? "Rejecting..." : "Reject Question"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructions">Revision Instructions</Label>
          <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="What changes are needed..." />
          <Button variant="secondary" size="sm" onClick={() => handleAction("request-revision")} disabled={loading !== null} className="w-full">
            {loading === "request-revision" ? "Requesting..." : "Request Revision"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
