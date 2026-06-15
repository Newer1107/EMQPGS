import { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function CoeDashboardPage() {
  const data = await getDashboardSeed(Role.COE);
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">COE Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Controller of Examination — govern access, academic structure, and audit controls</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pending Tasks</CardTitle></CardHeader>
          <CardContent>
            {data.pendingTasks.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No pending tasks</p>
            ) : (
              <ul className="space-y-2">
                {data.pendingTasks.map((task) => <li key={task} className="text-sm">{task}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent>
            {data.notifications.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No notifications</p>
            ) : (
              <ul className="space-y-2">
                {(data.notifications as Array<{ id: string; title: string }>).map((item) => <li key={item.id} className="text-sm">{item.title}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
