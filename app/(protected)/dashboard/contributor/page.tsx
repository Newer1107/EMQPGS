import Link from "next/link";
import { Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getDashboardSeed } from "@/lib/server-data";

export default async function ContributorDashboardPage() {
  const data = await getDashboardSeed(Role.CONTRIBUTOR);
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contributor Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Contribute questions and track your submissions</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {data.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <Card>
        <CardHeader><CardTitle>Open Tasks</CardTitle></CardHeader>
        <CardContent>
          {data.pendingTasks.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No open tasks</p>
          ) : (
            <ul className="space-y-2">
              {data.pendingTasks.map((task) => <li key={task} className="text-sm">{task}</li>)}
            </ul>
          )}
          <Link href="/dashboard/contributor/questions" className="mt-4 inline-flex text-sm font-medium text-[var(--foreground)] hover:underline">
            Open question workspace &rarr;
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
