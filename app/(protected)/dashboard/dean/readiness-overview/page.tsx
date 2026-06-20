import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDeanReviewData } from "@/lib/server-data";
import { CheckCircle2, Circle, FileText, FileSpreadsheet, ShieldCheck } from "lucide-react";

export default async function DeanReadinessOverviewPage() {
  const data = await getDeanReviewData();

  const allItems = [...data.pendingReviews, ...data.completedReviews];
  const total = allItems.length;

  const papersGenerated = total;
  const aiReportsDone = allItems.filter((item) => item.aiSummary != null).length;
  const selectionsComplete = data.completedReviews.length;

  const progressPct = total > 0 ? Math.round((selectionsComplete / total) * 100) : 100;

  const steps = [
    {
      label: "Papers Generated",
      done: papersGenerated,
      total: total,
      icon: FileText,
      complete: papersGenerated === total && total > 0,
    },
    {
      label: "AI Reports Complete",
      done: aiReportsDone,
      total: total,
      icon: FileSpreadsheet,
      complete: aiReportsDone === total && total > 0,
    },
    {
      label: "Dean Selection Complete",
      done: selectionsComplete,
      total: total,
      icon: ShieldCheck,
      complete: selectionsComplete === total && total > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Readiness Overview"
        description="Track system readiness across all question banks requiring dean review."
      />

      <Card>
        <CardHeader>
          <CardTitle>System Readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[var(--text-primary)]">{progressPct}%</span>
              <span className="text-[var(--text-tertiary)]">{selectionsComplete} of {total} banks complete</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            {steps.map((step) => {
              const Icon = step.icon;
              const isComplete = step.complete;
              return (
                <div key={step.label} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-[var(--text-tertiary)]" />
                  )}
                  <Icon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isComplete ? "text-green-700" : "text-[var(--text-primary)]"}`}>
                      {step.label}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-[var(--text-tertiary)]">
                    {step.done}/{step.total}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
