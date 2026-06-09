import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function CoordinatorDashboardPage() {
  const data = await getDashboardSeed(Role.COORDINATOR);
  if (!data) return null;
  return (
    <div className="space-y-8">
      <div className="section-frame flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="page-kicker">Coordinator</p>
          <h1 className="page-display mt-4">COORDINATE</h1>
          <p className="page-lead mt-6">Manage subjects, question banks, teacher assignments, and contribution readiness without visual noise.</p>
        </div>
        <Badge>Coordinator</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <Card>
        <CardHeader><CardTitle>Pending Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.pendingTasks.map((task) => <p key={task} className="border-b border-[var(--border-light)] pb-3 text-base">{task}</p>)}
          <a href="/dashboard/coordinator/questions" className="inline-flex border-b border-[var(--foreground)] pb-1 font-mono text-[11px] uppercase tracking-[0.2em]">Open contribution monitor</a>
        </CardContent>
      </Card>
    </div>
  );
}
