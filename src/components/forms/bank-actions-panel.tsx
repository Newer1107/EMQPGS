"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { CoordinatorDecisionForm } from "@/components/forms/coordinator-decision-form";
import { questionBankStatusLabels } from "@/lib/constants";

type BankActionsPanelProps = {
  questionBankId: string;
  currentStatus: string;
  hasAiReports: boolean;
  hasPapers: boolean;
};

export function BankActionsPanel({ questionBankId, currentStatus, hasAiReports, hasPapers }: BankActionsPanelProps) {
  const router = useRouter();

  function refresh() { router.refresh(); }

  const canLock = currentStatus !== "LOCKED";
  const canUnlock = currentStatus === "LOCKED";
  const canGeneratePaper = currentStatus === "UNDER_MODERATION" || currentStatus === "MODERATED" || currentStatus === "APPROVED";
  const canSubmitForModeration = currentStatus === "IN_PROGRESS";
  const canGenerateReport = currentStatus === "IN_PROGRESS" || currentStatus === "UNDER_MODERATION" || currentStatus === "MODERATED";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          Current Status: <span className="font-medium text-[var(--foreground)]">{questionBankStatusLabels[currentStatus as keyof typeof questionBankStatusLabels] ?? currentStatus}</span>
        </p>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">MODERATION</p>
          {canSubmitForModeration ? (
            <ActionButton
              label="Submit For Moderation"
              endpoint={`/api/question-banks/${questionBankId}/status`}
              method="PATCH"
              body={{ status: "UNDER_MODERATION" }}
              confirmMessage="Submit this question bank for moderation? Questions will be locked for editing."
              successMessage="Question bank submitted for moderation"
              onSuccess={refresh}
              variant="default"
              size="sm"
            />
          ) : (
            <p className="text-xs text-[var(--muted-foreground)] italic">
              {currentStatus === "UNDER_MODERATION" ? "Already submitted for moderation" : "Bank must be IN_PROGRESS to submit"}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">PAPER GENERATION</p>
          <ActionButton
            label={hasPapers ? "Regenerate Papers" : "Generate Papers"}
            endpoint={`/api/question-banks/${questionBankId}/papers`}
            method="POST"
            confirmMessage="Generate question papers? This may take a moment."
            successMessage="Paper generation triggered"
            onSuccess={refresh}
            disabled={!canGeneratePaper}
            size="sm"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">AI REPORT</p>
          <ActionButton
            label={hasAiReports ? "Regenerate AI Report" : "Generate AI Report"}
            endpoint={`/api/question-banks/${questionBankId}/reports`}
            method="POST"
            confirmMessage="Generate AI analysis report?"
            successMessage="AI report generation triggered"
            onSuccess={refresh}
            disabled={!canGenerateReport}
            size="sm"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">BANK LOCK</p>
          <ActionButton
            label="Lock Question Bank"
            endpoint={`/api/question-banks/${questionBankId}/lock`}
            method="PATCH"
            confirmMessage="Lock this question bank? This cannot be undone."
            successMessage="Question bank locked"
            onSuccess={refresh}
            disabled={!canLock}
            variant="outline"
            size="sm"
          />
          {canUnlock && (
            <ActionButton
              label="Unlock Question Bank"
              endpoint={`/api/question-banks/${questionBankId}/unlock`}
              method="POST"
              body={{ reason: "Unlocked by coordinator" }}
              confirmMessage="Unlock this question bank? This allows status changes again."
              successMessage="Question bank unlocked"
              onSuccess={refresh}
              variant="ghost"
              size="sm"
            />
          )}
        </div>

        <CoordinatorDecisionForm questionBankId={questionBankId} />
      </CardContent>
    </Card>
  );
}
