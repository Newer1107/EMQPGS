import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricTile } from "@/components/ui/metric-tile";
import { NextActions } from "@/components/dashboard/next-actions";
import { AttentionSection } from "@/components/dashboard/attention-card";
import type { Severity } from "@/components/dashboard/types";
import { NotificationInbox } from "@/components/moderator/notification-inbox";
import { Shield, CheckCircle2, Clock, Eye } from "lucide-react";
import { getDeanReviewData } from "@/lib/server-data";

export default async function DeanDashboardPage() {
  const data = await getDeanReviewData();

  // Pending reviews are now sorted by daysWaiting desc (oldest first) from service
  const oldestPending = data.pendingReviews[0] ?? null;

  // Attention: show oldest pending review with urgency
  const attentionItems = oldestPending ? [{
    id: "oldest-pending",
    title: `${oldestPending.subjectName} (${oldestPending.subjectCode})`,
    description: `Waiting ${oldestPending.daysWaiting} day${oldestPending.daysWaiting !== 1 ? "s" : ""} for review · ${oldestPending.examCycleLabel}`,
    href: `/dashboard/dean/review?bank=${oldestPending.id}`,
    severity: (oldestPending.daysWaiting > 7 ? "critical" : oldestPending.daysWaiting > 3 ? "warning" : "info") as "critical" | "warning" | "info",
  }] : [];

  // Next actions: start oldest review, plus other pending sorted by urgency
  const pendingActions = data.pendingReviews.slice(0, 3).map((item, idx) => ({
    id: `review-${item.id}`,
    title: `${item.subjectCode} · ${item.subjectName}`,
    description: `${item.examCycleLabel} · Waiting ${item.daysWaiting}d`,
    href: `/dashboard/dean/review?bank=${item.id}`,
    priority: idx + 1,
    severity: (item.daysWaiting > 7 ? "critical" : item.daysWaiting > 3 ? "warning" : "info") as "critical" | "warning" | "info" | "success",
  }));

  return (
    <div className="space-y-6">
      {/* ZONE 1 */}
      <PageHeader
        title="Final Paper Review"
        description="Review AI-scored candidate papers and assign the regular, supplementary, and KT slots."
        actions={<Badge variant="info">{data.unreadNotificationCount} unread</Badge>}
      />

      {/* ZONE 2: What Needs My Attention */}
      <AttentionSection items={attentionItems} />

      {/* ZONE 3: What Should I Do Next */}
      {oldestPending && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Start Oldest Review</p>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
              {oldestPending.subjectName} ({oldestPending.subjectCode}) — waiting {oldestPending.daysWaiting}d
            </p>
          </div>
          <Link href={`/dashboard/dean/review?bank=${oldestPending.id}`}>
            <Button size="sm">
              Review Now
            </Button>
          </Link>
        </div>
      )}

      {pendingActions.length > 1 && <NextActions actions={pendingActions.slice(1)} max={5} title="" />}

      {/* ZONE 4: Current Workload */}
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricTile icon={<Shield className="h-5 w-5" />} value={data.pendingReviews.length} label="Pending Reviews" />
        <MetricTile icon={<CheckCircle2 className="h-5 w-5" />} value={data.completedReviews.length} label="Completed" />
        <MetricTile icon={<Eye className="h-5 w-5" />} value={data.pendingReviews.length + data.completedReviews.length} label="Total Reviews" />
        <MetricTile icon={<Clock className="h-5 w-5" />} value={oldestPending ? `${oldestPending.daysWaiting}d` : "—"} label="Oldest Waiting" />
      </div>

      {/* Zone 5: Everything Else — Pending reviews */}
      <section className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
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

        <NotificationInbox initialNotifications={data.notifications} variant="card" onError="silent" />
      </section>

      {/* Approval History */}
      <Card>
        <CardHeader>
          <CardTitle>Approval History</CardTitle>
        </CardHeader>
        <CardContent>
          {data.approvalHistory.length === 0 ? (
            <EmptyState title="No approval history available" description="Completed dean reviews will appear here once submitted." />
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
                    <th className="pb-2 font-medium">Approved At</th>
                  </tr>
                </thead>
                <tbody>
                  {data.approvalHistory.map((entry, idx) => (
                    <tr key={idx} className="border-t border-[var(--border)]">
                      <td className="py-2.5 pr-4 font-medium">{entry.subjectCode} · {entry.subjectName}</td>
                      <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{entry.examCycleLabel}</td>
                      <td className="py-2.5 pr-4">{entry.regularPaper}</td>
                      <td className="py-2.5 pr-4">{entry.supplementaryPaper}</td>
                      <td className="py-2.5 pr-4">{entry.ktPaper}</td>
                      <td className="py-2.5 whitespace-nowrap text-[var(--text-tertiary)]">
                        {new Date(entry.reviewedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Reviews */}
      <Card>
        <CardHeader>
          <CardTitle>Completed Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.completedReviews.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No completed dean reviews yet.</p>
          ) : data.completedReviews.map((item) => (
            <div key={item.id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold">{item.subjectCode} · {item.subjectName}</p>
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">{item.examCycleLabel}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    Generated {item.generationTimestamp ? new Date(item.generationTimestamp).toLocaleString() : "Unavailable"}
                  </p>
                </div>
                <Link className="text-sm font-medium underline underline-offset-4" href={`/dashboard/dean/review?bank=${item.id}`}>
                  View review
                </Link>
              </div>
              {item.reviewSummary ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <ReviewSummary label="Regular" value={item.reviewSummary.regularPaper} />
                  <ReviewSummary label="Supplementary" value={item.reviewSummary.supplementaryPaper} />
                  <ReviewSummary label="KT" value={item.reviewSummary.ktPaper} />
                </div>
              ) : null}
            </div>
          ))}
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
