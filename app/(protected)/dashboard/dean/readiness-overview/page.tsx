import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDeanReviewData } from "@/lib/server-data";

export default async function DeanReadinessOverviewPage() {
  const data = await getDeanReviewData();

  return (
    <div className="space-y-8">
      <div className="section-frame">
        <p className="page-kicker">Dean</p>
        <h1 className="page-display mt-4">READINESS OVERVIEW</h1>
        <p className="page-lead mt-6">Overview of all question banks awaiting dean review.</p>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pending Reviews ({data.pendingReviews.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.pendingReviews.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No banks awaiting review.</p>
            ) : data.pendingReviews.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-semibold">{item.subjectCode} · {item.subjectName}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{item.examCycleLabel}</p>
                <Badge className="mt-2">Pending</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Completed Reviews ({data.completedReviews.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.completedReviews.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No completed reviews yet.</p>
            ) : data.completedReviews.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-semibold">{item.subjectCode} · {item.subjectName}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{item.examCycleLabel}</p>
                <Badge className="mt-2">Completed</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
