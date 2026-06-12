import { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed, getDeanReviewData } from "@/lib/server-data";

export default async function DeanReadinessOverviewPage() {
  const data = await getDashboardSeed(Role.DEAN);
  const banks = await getDeanReviewData();
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Readiness Overview</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Review which question banks are ready for dean decisions and which still need action.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {banks.map((bank) => (
          <Card key={bank.id}>
            <CardHeader>
              <CardTitle className="text-xl">{bank.subject.subjectCode}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{bank.subject.subjectName}</p>
              <p>{bank.examCycle.academicYear} / Semester {bank.examCycle.semester}</p>
              <p>Generated Papers: {bank.generatedPapers.length}</p>
              <p>AI Report: {bank.aiReports[0]?.status ?? "Not generated"}</p>
              <p className={bank.deanReview ? "text-green-700" : "text-amber-700"}>
                {bank.deanReview ? "Selection completed" : "Awaiting dean selection"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
