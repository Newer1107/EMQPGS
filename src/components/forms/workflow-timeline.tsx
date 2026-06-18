"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { questionBankPhaseLabels, recordStatusLabels } from "@/lib/constants";

const PHASE_FLOW = [
  { phase: "DRAFTING", role: "Contributor", action: "Fill slots with questions" },
  { phase: "MODERATION", role: "Moderator", action: "Review and approve questions" },
  { phase: "APPROVAL", role: "Coordinator", action: "Review AI report and decide" },
  { phase: "COMPLETE", role: "Coordinator", action: "Generate papers, dean review, lock" },
] as const;

type WorkflowTimelineProps = {
  phase: string;
  recordStatus: string;
};

export function WorkflowTimeline({ phase, recordStatus }: WorkflowTimelineProps) {
  const currentIndex = PHASE_FLOW.findIndex((p) => p.phase === phase);
  const isLocked = recordStatus === "LOCKED";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {PHASE_FLOW.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isNext = index === currentIndex + 1;

            let stateClass = "border-[var(--border)] text-[var(--text-tertiary)]";
            let indicator = "○";
            if (isCompleted) { stateClass = "border-green-500 text-green-700"; indicator = "●"; }
            if (isCurrent) { stateClass = "border-blue-500 text-blue-700 bg-blue-50"; indicator = "◆"; }
            if (isNext) { stateClass = "border-amber-400 text-amber-700 bg-amber-50"; indicator = "◇"; }

            return (
              <div key={step.phase} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${stateClass}`}>
                <span className="mt-0.5 text-base">{indicator}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isCurrent ? "text-blue-800" : ""}`}>
                      {questionBankPhaseLabels[step.phase as keyof typeof questionBankPhaseLabels] ?? step.phase}
                    </span>
                    {isCurrent && <span className="text-xs font-medium text-blue-600">Current</span>}
                    {isCompleted && <span className="text-xs text-green-600">Complete</span>}
                    {isNext && <span className="text-xs font-medium text-amber-600">Up next</span>}
                  </div>
                  <p className="text-xs mt-0.5 opacity-75">
                    {step.role}: {step.action}
                  </p>
                </div>
              </div>
            );
          })}
          {isLocked && (
            <div className="flex items-start gap-3 rounded-lg border p-3 text-sm border-red-400 text-red-700 bg-red-50">
              <span className="mt-0.5 text-base">🔒</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-red-800">Locked</span>
                <p className="text-xs mt-0.5 opacity-75">Bank is locked. No further modifications allowed.</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
