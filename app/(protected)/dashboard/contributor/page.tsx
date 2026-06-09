import { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function ContributorDashboardPage() {
  const data = await getDashboardSeed(Role.CONTRIBUTOR);
  if (!data) return null;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Contributor Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <Card>
        <CardHeader><CardTitle>Open Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3">{data.pendingTasks.map((task) => <p key={task} className="rounded-xl bg-slate-50 p-3 text-sm">{task}</p>)}</CardContent>
      </Card>
    </div>
  );
}
