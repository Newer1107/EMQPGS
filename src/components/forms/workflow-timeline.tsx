"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { questionBankStatusLabels } from "@/lib/constants";

const STATUS_FLOW = [
  "IN_PROGRESS",
  "UNDER_MODERATION",
  "MODERATED",
  "REPORT_GENERATED",
  "AWAITING_HOD_SIGN",
  "SIGNED_REPORT_UPLOADED",
  "AWAITING_COORDINATOR_APPROVAL",
  "APPROVED",
  "LOCKED",
] as const;

const STATUS_RESPONSIBILITY: Record<string, { role: string; action: string }> = {
  IN_PROGRESS: { role: "Coordinator", action: "Submit for moderation" },
  UNDER_MODERATION: { role: "Moderator", action: "Review and approve questions" },
  MODERATED: { role: "Coordinator", action: "Generate AI report" },
  REPORT_GENERATED: { role: "HOD / Moderator", action: "Upload signed report" },
  AWAITING_HOD_SIGN: { role: "HOD / Moderator", action: "Upload signed report" },
  SIGNED_REPORT_UPLOADED: { role: "Coordinator", action: "Make coordinator decision" },
  AWAITING_COORDINATOR_APPROVAL: { role: "Coordinator", action: "Approve or reject" },
  APPROVED: { role: "Coordinator", action: "Lock question bank" },
  LOCKED: { role: "Dean", action: "Review papers" },
};

type WorkflowTimelineProps = {
  currentStatus: string;
};

export function WorkflowTimeline({ currentStatus }: WorkflowTimelineProps) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus as typeof STATUS_FLOW[number]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {STATUS_FLOW.map((status, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isNext = index === currentIndex + 1;
            const responsibility = STATUS_RESPONSIBILITY[status];

            let stateClass = "border-[var(--border)] text-[var(--muted-foreground)]";
            let indicator = "○";
            if (isCompleted) { stateClass = "border-green-500 text-green-700"; indicator = "●"; }
            if (isCurrent) { stateClass = "border-blue-500 text-blue-700 bg-blue-50"; indicator = "◆"; }
            if (isNext) { stateClass = "border-amber-400 text-amber-700 bg-amber-50"; indicator = "◇"; }

            return (
              <div key={status} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${stateClass}`}>
                <span className="mt-0.5 text-base">{indicator}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isCurrent ? "text-blue-800" : ""}`}>
                      {questionBankStatusLabels[status as keyof typeof questionBankStatusLabels] ?? status}
                    </span>
                    {isCurrent && <span className="text-xs font-medium text-blue-600">Current</span>}
                    {isCompleted && <span className="text-xs text-green-600">Complete</span>}
                    {isNext && <span className="text-xs font-medium text-amber-600">Next</span>}
                  </div>
                  {responsibility && (
                    <p className="text-xs mt-0.5 opacity-75">
                      {responsibility.role}: {responsibility.action}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
