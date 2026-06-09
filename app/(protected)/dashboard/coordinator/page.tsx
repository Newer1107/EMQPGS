import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function CoordinatorDashboardPage() {
  const data = await getDashboardSeed(Role.COORDINATOR);
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Coordinator Dashboard</h1>
          <p className="mt-2 text-slate-600">Manage subjects, question banks, and teacher assignments.</p>
        </div>
        <Badge>Coordinator</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <Card>
        <CardHeader><CardTitle>Pending Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3">{data.pendingTasks.map((task) => <p key={task} className="rounded-xl bg-slate-50 p-3 text-sm">{task}</p>)}</CardContent>
      </Card>
    </div>
  );
}
