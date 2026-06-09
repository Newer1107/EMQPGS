import { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function DeanDashboardPage() {
  const data = await getDashboardSeed(Role.DEAN);
  if (!data) return null;
  return (
    <div className="space-y-8">
      <div className="section-frame">
        <p className="page-kicker">Dean</p>
        <h1 className="page-display mt-4">OVERSIGHT</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <Card>
        <CardHeader><CardTitle>Readiness Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">{data.pendingTasks.map((task) => <p key={task} className="border-b border-[var(--border-light)] pb-3 text-base">{task}</p>)}</CardContent>
      </Card>
    </div>
  );
}
