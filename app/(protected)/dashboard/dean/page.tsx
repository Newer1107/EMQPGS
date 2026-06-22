import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PrimaryAction } from "@/components/dashboard/primary-action";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import { TaskQueue } from "@/components/dashboard/task-queue";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Severity } from "@/components/dashboard/types";
import { Shield, CheckCircle2, Clock, Eye } from "lucide-react";
import { getDeanReviewData } from "@/lib/server-data";

export default async function DeanDashboardPage() {
  const data = await getDeanReviewData();

  // Pending reviews sorted by daysWaiting desc (oldest first) from service
  const oldestPending = data.pendingReviews[0] ?? null;

  // Critical: pending reviews waiting > 7 days
  const criticalItems: Array<{ id: string; title: string; description: string; href: string; severity: Severity }> = data.pendingReviews
    .filter((item) => item.daysWaiting > 7)
    .map((item) => ({
      id: `critical-${item.id}`,
      title: `${item.subjectName} (${item.subjectCode})`,
      description: `Waiting ${item.daysWaiting} day${item.daysWaiting !== 1 ? "s" : ""} · ${item.examCycleLabel}`,
      href: `/dashboard/dean/review?bank=${item.id}`,
      severity: "critical" as Severity,
    }));

  // TaskQueue: remaining pending reviews (excluding the PrimaryAction one)
  const remainingQueueItems = data.pendingReviews.slice(1).map((item) => ({
    id: `queue-${item.id}`,
    title: `${item.subjectCode} · ${item.subjectName}`,
    subtitle: item.examCycleLabel,
    href: `/dashboard/dean/review?bank=${item.id}`,
    badge: {
      label: `${item.daysWaiting}d waiting`,
      variant: (item.daysWaiting > 7 ? "danger" : item.daysWaiting > 3 ? "warning" : "info") as "danger" | "warning" | "info",
    },
    meta: item.qualityScore != null ? `QS: ${item.qualityScore}/10` : undefined,
    metaVariant: item.daysWaiting > 7 ? ("danger" as const) : item.daysWaiting > 3 ? ("warning" as const) : undefined,
  }));

  // Merge approvalHistory + completedReviews into one sorted list
  const approvalKeys = new Set(data.approvalHistory.map((a) => `${a.subjectCode}|${a.examCycleLabel}`));
  const mergedHistory = [
    ...data.approvalHistory.map((entry) => ({
      key: `approval-${entry.subjectCode}-${entry.examCycleLabel}`,
      subjectCode: entry.subjectCode,
      subjectName: entry.subjectName,
      examCycleLabel: entry.examCycleLabel,
      regularPaper: entry.regularPaper,
      supplementaryPaper: entry.supplementaryPaper,
      ktPaper: entry.ktPaper,
      reviewedAt: entry.reviewedAt,
      type: "Approval" as const,
    })),
    ...data.completedReviews
      .filter((item) => !approvalKeys.has(`${item.subjectCode}|${item.examCycleLabel}`))
      .map((item) => ({
        key: `completed-${item.id}`,
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        examCycleLabel: item.examCycleLabel,
        regularPaper: item.reviewSummary?.regularPaper ?? "—",
        supplementaryPaper: item.reviewSummary?.supplementaryPaper ?? "—",
        ktPaper: item.reviewSummary?.ktPaper ?? "—",
        reviewedAt: item.reviewedAt ?? "",
        type: "Completed" as const,
      })),
  ].sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());

  return (
    <div className="space-y-6">
      {/* ZONE 1: DashboardHeader — greeting, summary badges */}
      <DashboardHeader
        title="Final Paper Review"
        description="Review AI-scored candidate papers and assign the regular, supplementary, and KT slots."
        greeting="Dean Dashboard"
        summary={[
          { label: "Pending", count: data.pendingReviews.length, variant: "warning" },
          { label: "Completed", count: data.completedReviews.length, variant: "success" },
          { label: "Total Reviews", count: data.pendingReviews.length + data.completedReviews.length, variant: "info" },
        ]}
      />

      {/* ZONE 2: PrimaryAction — "Review: [Oldest Subject]" */}
      {oldestPending && (
        <PrimaryAction
          title={`Review: ${oldestPending.subjectName}`}
          description={`${oldestPending.subjectCode} · ${oldestPending.examCycleLabel} · Waiting ${oldestPending.daysWaiting}d`}
          href={`/dashboard/dean/review?bank=${oldestPending.id}`}
          variant={oldestPending.daysWaiting > 7 ? "warning" : "default"}
        />
      )}

      {/* ZONE 3: AlertBanner — critical reviews waiting > 7 days */}
      {criticalItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Overdue Reviews</h2>
          <AlertBanner items={criticalItems} />
        </section>
      )}

      {/* ZONE 4: TaskQueue — Next Reviews (excluding the PrimaryAction one) */}
      {remainingQueueItems.length > 0 && (
        <TaskQueue
          items={remainingQueueItems}
          title="Next Reviews"
        />
      )}

      {/* ZONE 5: StatCards row — compact */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          value={data.pendingReviews.length}
          label="Pending Reviews"
          size="sm"
          variant={data.pendingReviews.length > 0 ? "warning" : "default"}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={data.completedReviews.length}
          label="Completed"
          size="sm"
          variant={data.completedReviews.length > 0 ? "success" : "default"}
        />
        <StatCard
          icon={<Eye className="h-4 w-4" />}
          value={data.pendingReviews.length + data.completedReviews.length}
          label="Total Reviews"
          size="sm"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          value={oldestPending ? `${oldestPending.daysWaiting}d` : "—"}
          label="Oldest Waiting"
          size="sm"
          variant={oldestPending && oldestPending.daysWaiting > 7 ? "warning" : "default"}
        />
      </div>

      {/* ZONE 6: Pending Reviews detail — quality scores, AI summaries preserved */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews ({data.pendingReviews.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.pendingReviews.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No pending dean reviews.</p>
          ) : data.pendingReviews.map((item) => (
            <div key={item.id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold">{item.subjectCode} · {item.subjectName}</p>
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">{item.examCycleLabel}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Generated {item.generationTimestamp ? new Date(item.generationTimestamp).toLocaleString() : "Unavailable"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={item.daysWaiting > 7 ? "danger" : item.daysWaiting > 3 ? "warning" : "info"}>
                    {item.daysWaiting}d waiting
                  </Badge>
                  <Link className="text-sm font-medium underline underline-offset-4" href={`/dashboard/dean/review?bank=${item.id}`}>
                    Review papers
                  </Link>
                  <Link className="text-sm font-medium text-[var(--accent)] underline underline-offset-4" href={`/dashboard/dean/analysis?bank=${item.id}`}>
                    UAF Analysis
                  </Link>
                </div>
              </div>
              {(item.qualityScore != null || item.coverageScore != null || item.aiSummary) ? (
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
                  {item.qualityScore != null && item.coverageScore != null && (
                    <p className="text-[var(--text-secondary)]">
                      Quality Score: <span className="font-semibold text-[var(--text-primary)]">{item.qualityScore}/10</span>
                      {" · "}
                      Coverage: <span className="font-semibold text-[var(--text-primary)]">{item.coverageScore}%</span>
                    </p>
                  )}
                  {item.aiSummary && (
                    <p className="mt-1 text-xs text-[var(--text-tertiary)] line-clamp-2">{item.aiSummary}</p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[var(--text-tertiary)] italic">No AI report yet</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ZONE 7: Review History — merged approvalHistory + completedReviews */}
      <Card>
        <CardHeader>
          <CardTitle>Review History ({mergedHistory.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {mergedHistory.length === 0 ? (
            <EmptyState title="No review history available" description="Completed dean reviews will appear here once submitted." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--text-tertiary)] text-xs uppercase tracking-[0.08em]">
                    <th className="pb-2 pr-4 font-medium">Subject</th>
                    <th className="pb-2 pr-4 font-medium">Cycle</th>
                    <th className="pb-2 pr-4 font-medium">Regular Paper</th>
                    <th className="pb-2 pr-4 font-medium">Supplementary</th>
                    <th className="pb-2 pr-4 font-medium">KT</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedHistory.map((entry) => (
                    <tr key={entry.key} className="border-t border-[var(--border)]">
                      <td className="py-2.5 pr-4 font-medium">{entry.subjectCode} · {entry.subjectName}</td>
                      <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{entry.examCycleLabel}</td>
                      <td className="py-2.5 pr-4">{entry.regularPaper}</td>
                      <td className="py-2.5 pr-4">{entry.supplementaryPaper}</td>
                      <td className="py-2.5 pr-4">{entry.ktPaper}</td>
                      <td className="py-2.5 whitespace-nowrap text-[var(--text-tertiary)]">
                        {new Date(entry.reviewedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5">
                        <Badge variant={entry.type === "Approval" ? "success" : "info"}>
                          {entry.type === "Approval" ? "Approved" : "Completed"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-hover)] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
