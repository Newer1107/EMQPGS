import { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function ContributorDashboardPage() {
  const data = await getDashboardSeed(Role.CONTRIBUTOR);
  if (!data) return null;
  return (
    <div className="space-y-8">
      <div className="section-frame">
        <p className="page-kicker">Contributor</p>
        <h1 className="page-display mt-4">CONTRIBUTE</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <Card>
        <CardHeader><CardTitle>Open Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.pendingTasks.map((task) => <p key={task} className="border-b border-[var(--border-light)] pb-3 text-base">{task}</p>)}
          <a href="/dashboard/contributor/questions" className="inline-flex border-b border-[var(--foreground)] pb-1 font-mono text-[11px] uppercase tracking-[0.2em]">Open my question workspace</a>
        </CardContent>
      </Card>
    </div>
  );
}
