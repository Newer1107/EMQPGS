import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function CoeDashboardPage() {
  const data = await getDashboardSeed(Role.COE);
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">COE Dashboard</h1>
          <p className="mt-2 text-slate-600">Govern access, academic structure, and audit controls.</p>
        </div>
        <Badge>Controller of Examination</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pending Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-3">{data.pendingTasks.map((task) => <p key={task} className="rounded-xl bg-slate-50 p-3 text-sm">{task}</p>)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">{data.notifications.map((item) => <p key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">{item.title}</p>)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
