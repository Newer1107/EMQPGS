import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationInbox } from "@/components/moderator/notification-inbox";
import { getDeanReviewData } from "@/lib/server-data";

export default async function DeanDashboardPage() {
  const data = await getDeanReviewData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Final Paper Review"
        description="Review AI-scored candidate papers and assign the regular, supplementary, and KT slots."
        actions={<Badge variant="info">{data.unreadNotificationCount} unread</Badge>}
      />

      <section className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pending Reviews</CardTitle>
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
                  <Link className="text-sm font-medium underline underline-offset-4" href={`/dashboard/dean/review?bank=${item.id}`}>
                    Review papers
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <NotificationInbox initialNotifications={data.notifications} variant="card" onError="silent" />
      </section>

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
