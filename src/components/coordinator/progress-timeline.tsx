const stages = [
  { key: "created", label: "Exam Cycle Created" },
  { key: "initialized", label: "Banks Initialized" },
  { key: "contributors", label: "Contributors Assigned" },
  { key: "drafting", label: "Drafting" },
  { key: "moderation", label: "Moderation" },
  { key: "approval", label: "Approval" },
  { key: "papers", label: "Paper Generation" },
  { key: "dean", label: "Dean Review" },
  { key: "complete", label: "Completed" },
];

function getCurrentStage(banks: { phase: string }[]): number {
  if (banks.length === 0) return 0;
  const phases = banks.map((b) => b.phase);
  const allComplete = phases.every((p) => p === "COMPLETE");
  if (allComplete) return 8;
  const allApproval = phases.every((p) => p === "APPROVAL" || p === "COMPLETE");
  if (allApproval) return 5;
  const allModeration = phases.every((p) => p === "MODERATION" || p === "APPROVAL" || p === "COMPLETE");
  if (allModeration) return 4;
  const allDrafting = phases.every((p) => p === "DRAFTING" || p === "MODERATION" || p === "APPROVAL" || p === "COMPLETE");
  if (allDrafting) return 3;
  if (banks.length > 0) return 1;
  return 0;
}

export function ProgressTimeline({ banks }: { banks: { phase: string }[] }) {
  const currentStage = getCurrentStage(banks);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Timeline</h3>
      <div className="space-y-0">
        {stages.map((stage, i) => {
          const isPast = i < currentStage;
          const isCurrent = i === currentStage;
          return (
            <div key={stage.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    isPast
                      ? "border-green-500 bg-green-500"
                      : isCurrent
                        ? "border-[var(--foreground)] bg-[var(--foreground)]"
                        : "border-[var(--border)] bg-white"
                  }`}
                >
                  {isPast ? (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </div>
                {i < stages.length - 1 && (
                  <div className={`h-6 w-px ${isPast ? "bg-green-500" : "bg-[var(--border)]"}`} />
                )}
              </div>
              <div className={`pb-6 text-sm ${isPast ? "text-[var(--muted-foreground)]" : isCurrent ? "font-medium text-[var(--foreground)]" : "text-[var(--muted-foreground)] opacity-50"}`}>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
