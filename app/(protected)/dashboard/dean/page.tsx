import { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function DeanDashboardPage() {
  const data = await getDashboardSeed(Role.DEAN);
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dean Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Approval visibility and readiness overview</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <Card>
        <CardHeader><CardTitle>Readiness Notes</CardTitle></CardHeader>
        <CardContent>
          {data.pendingTasks.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No readiness notes</p>
          ) : (
            <ul className="space-y-2">
              {data.pendingTasks.map((task) => <li key={task} className="text-sm">{task}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
