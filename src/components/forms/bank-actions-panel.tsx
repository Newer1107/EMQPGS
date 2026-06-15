"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { CoordinatorDecisionForm } from "@/components/forms/coordinator-decision-form";

type BankActionsPanelProps = {
  questionBankId: string;
  phase: string;
  recordStatus: string;
};

export function BankActionsPanel({ questionBankId, phase, recordStatus }: BankActionsPanelProps) {
  const router = useRouter();
  const isLocked = recordStatus === "LOCKED";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {phase === "DRAFTING" && !isLocked && (
          <ActionButton
            endpoint={`/api/question-banks/${questionBankId}/advance`}
            method="PATCH"
            label="Advance to Moderation"
            body={{ targetPhase: "MODERATION" }}
            onSuccess={() => router.refresh()}
          />
        )}
        {phase === "MODERATION" && !isLocked && (
          <ActionButton
            endpoint={`/api/question-banks/${questionBankId}/advance`}
            method="PATCH"
            label="Advance to Approval"
            body={{ targetPhase: "APPROVAL" }}
            onSuccess={() => router.refresh()}
          />
        )}
        {phase === "APPROVAL" && !isLocked && (
          <CoordinatorDecisionForm questionBankId={questionBankId} />
        )}
        {phase === "COMPLETE" && !isLocked && (
          <ActionButton
            endpoint={`/api/question-banks/${questionBankId}/lock`}
            method="PATCH"
            label="Lock Question Bank"
            onSuccess={() => router.refresh()}
          />
        )}
        {isLocked && (
          <ActionButton
            endpoint={`/api/question-banks/${questionBankId}/unlock`}
            method="POST"
            label="Unlock"
            variant="outline"
            onSuccess={() => router.refresh()}
          />
        )}
      </CardContent>
    </Card>
  );
}
