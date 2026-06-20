"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
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
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
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
        if (!reason.trim()) { feedback.error("Please provide a rejection reason"); setLoading(null); return; }
        body = { reason: reason.trim() };
      }
      if (action === "request-revision") {
        if (!instructions.trim()) { feedback.error("Please provide revision instructions"); setLoading(null); return; }
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
        feedback.success({ title: msg, description: "The action was completed" });
        setTimeout(navigateToNext, 600);
      } else {
        console.error("[ModeratorActions]", result.error ?? result);
        feedback.error(result.error?.message ?? "Could not complete action");
      }
    } catch (error) {
      console.error("[ModeratorActions]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
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
          <p className="text-sm text-[var(--text-tertiary)]">{statusMessages[status] ?? `Status: ${status}`}</p>
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
        <p className="text-xs text-[var(--text-tertiary)]">
          Question {queueIds.indexOf(questionId) + 1} of {queueIds.length}
        </p>

        <Button variant="default" size="sm" onClick={() => handleAction("approve")} disabled={loading !== null} className="w-full">
          {loading === "approve" ? "Approving..." : "Approve Question"}
        </Button>

        <Button
          variant="danger"
          size="sm"
          onClick={() => setSelectedAction(selectedAction === "reject" ? null : "reject")}
          disabled={loading !== null}
          className="w-full"
        >
          {selectedAction === "reject" ? "Cancel Rejection" : "Reject Question"}
        </Button>

        {selectedAction === "reject" && (
          <div className="space-y-2">
            <Label htmlFor="reason">Rejection Reason</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Enter the reason for rejection..." />
            <Button variant="danger" size="sm" onClick={() => { setSelectedAction(null); handleAction("reject"); }} disabled={loading !== null} className="w-full">
              {loading === "reject" ? "Rejecting..." : "Submit Rejection"}
            </Button>
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSelectedAction(selectedAction === "request-revision" ? null : "request-revision")}
          disabled={loading !== null}
          className="w-full"
        >
          {selectedAction === "request-revision" ? "Cancel Revision Request" : "Request Revision"}
        </Button>

        {selectedAction === "request-revision" && (
          <div className="space-y-2">
            <Label htmlFor="instructions">Revision Instructions</Label>
            <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="What changes are needed..." />
            <Button variant="secondary" size="sm" onClick={() => { setSelectedAction(null); handleAction("request-revision"); }} disabled={loading !== null} className="w-full">
              {loading === "request-revision" ? "Requesting..." : "Submit Revision Request"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
