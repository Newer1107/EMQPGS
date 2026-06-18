"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/forms/action-button";
import { CoordinatorDecisionForm } from "@/components/forms/coordinator-decision-form";
import { apiFetch } from "@/lib/client-fetch";

type BankActionsPanelProps = {
  questionBankId: string;
  phase: string;
  recordStatus: string;
};

const NEXT_PHASE: Record<string, { target: string; label: string } | null> = {
  DRAFTING: { target: "MODERATION", label: "Moderation" },
  MODERATION: { target: "APPROVAL", label: "Approval" },
  APPROVAL: null,
  COMPLETE: null,
};

export function BankActionsPanel({ questionBankId, phase, recordStatus }: BankActionsPanelProps) {
  const router = useRouter();
  const isLocked = recordStatus === "LOCKED";
  const next = NEXT_PHASE[phase] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLocked && (
          <ActionButton
            endpoint={`/api/question-banks/${questionBankId}/unlock`}
            method="POST"
            label="Unlock"
            variant="outline"
            onSuccess={() => router.refresh()}
          />
        )}

        {next && !isLocked && (
          <AdvanceSection
            questionBankId={questionBankId}
            targetPhase={next.target}
            nextLabel={next.label}
            onSuccess={() => router.refresh()}
          />
        )}

        {phase === "APPROVAL" && !isLocked && (
          <>
            <ActionButton
              endpoint={`/api/question-banks/${questionBankId}/reports`}
              method="POST"
              label="Trigger AI Analysis"
              onSuccess={() => router.refresh()}
            />
            <CoordinatorDecisionForm questionBankId={questionBankId} />
          </>
        )}

        {(phase === "APPROVAL" || phase === "COMPLETE") && !isLocked && (
          <ActionButton
            endpoint={`/api/question-banks/${questionBankId}/papers`}
            method="POST"
            label="Generate Papers"
            onSuccess={() => router.refresh()}
          />
        )}

        {phase === "COMPLETE" && !isLocked && (
          <ActionButton
            endpoint={`/api/question-banks/${questionBankId}/lock`}
            method="PATCH"
            label="Lock Question Bank"
            onSuccess={() => router.refresh()}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AdvanceSection({
  questionBankId,
  targetPhase,
  nextLabel,
  onSuccess,
}: {
  questionBankId: string;
  targetPhase: string;
  nextLabel: string;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    ready: boolean | null;
    issues: string[];
    warnings: string[];
  }>({ loading: true, error: null, ready: null, issues: [], warnings: [] });

  function fetchReadiness() {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    apiFetch(`/api/question-banks/${questionBankId}/readiness?targetPhase=${targetPhase}`)
      .then((response) => {
        if (!response.ok) {
          setState((prev) => ({ ...prev, loading: false, error: `Request failed (${response.status})` }));
          return;
        }
        response.json().then((result) => {
          if (result.success && result.data) {
            setState({
              loading: false,
              error: null,
              ready: result.data.ready,
              issues: result.data.issues ?? [],
              warnings: result.data.warnings ?? [],
            });
          } else {
            setState((prev) => ({ ...prev, loading: false, error: result.error?.message ?? "Unknown error" }));
          }
        });
      })
      .catch(() => {
        setState((prev) => ({ ...prev, loading: false, error: "Network error" }));
      });
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchReadiness() }, [questionBankId, targetPhase]);

  if (state.loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3 text-sm text-[var(--text-tertiary)]">
        Checking readiness for {nextLabel}...
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-amber-800">Unable to determine readiness</span>
          <button onClick={fetchReadiness} className="text-xs text-amber-700 underline hover:no-underline">
            Retry
          </button>
        </div>
        <p className="mt-1 text-xs text-amber-600">{state.error}</p>
      </div>
    );
  }

  const canAdvance = state.ready === true;

  return (
    <div className="space-y-3">
      {canAdvance ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs text-white font-bold">✓</span>
            <span className="font-medium text-green-800">Ready for {nextLabel}</span>
          </div>
          {state.warnings.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-green-200 pt-2">
              {state.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                  <span className="mt-0.5 shrink-0">△</span>
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white font-bold">✗</span>
            <span className="font-medium text-red-800">Not ready for {nextLabel}</span>
          </div>
          {state.issues.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-red-700">Issues:</p>
              {state.issues.map((issue, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span>{issue}</span>
                </p>
              ))}
            </div>
          )}
          {state.warnings.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-red-200 pt-2">
              <p className="text-xs font-medium text-amber-700">Warnings:</p>
              {state.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                  <span className="mt-0.5 shrink-0">△</span>
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <ActionButton
        endpoint={`/api/question-banks/${questionBankId}/advance`}
        method="PATCH"
        label={`Advance to ${nextLabel}`}
        body={{ targetPhase }}
        onSuccess={onSuccess}
        disabled={!canAdvance}
        variant={canAdvance ? "default" : "secondary"}
      />
    </div>
  );
}
