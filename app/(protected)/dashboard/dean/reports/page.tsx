import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDeanReviewData } from "@/lib/server-data";

export default async function DeanReportsPage() {
  const data = await getDeanReviewData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Review summaries from completed dean reviews."
      />

      <Card>
        <CardHeader><CardTitle>Completed Review Summaries</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.completedReviews.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No completed reviews yet. Complete a review from the Dean Dashboard.</p>
          ) : data.completedReviews.map((item) => (
            <div key={item.id} className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-base font-semibold">{item.subjectCode} · {item.subjectName}</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.examCycleLabel}</p>
              {item.reviewSummary ? (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-[var(--muted)] p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Regular</p>
                    <p className="mt-1 text-sm font-semibold">{item.reviewSummary.regularPaper}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--muted)] p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Supplementary</p>
                    <p className="mt-1 text-sm font-semibold">{item.reviewSummary.supplementaryPaper}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--muted)] p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">KT</p>
                    <p className="mt-1 text-sm font-semibold">{item.reviewSummary.ktPaper}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
