import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function CoeDashboardPage() {
  const data = await getDashboardSeed(Role.COE);
  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="section-frame flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="page-kicker">Controller of Examination</p>
          <h1 className="page-display mt-4">COE</h1>
          <p className="page-lead mt-6">Govern access, academic structure, and audit controls through a monochrome command surface.</p>
        </div>
        <Badge>Controller of Examination</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pending Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-3">{data.pendingTasks.map((task) => <p key={task} className="border-b border-[var(--border-light)] pb-3 text-base">{task}</p>)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">{data.notifications.map((item) => <p key={item.id} className="border-b border-[var(--border-light)] pb-3 text-base">{item.title}</p>)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
