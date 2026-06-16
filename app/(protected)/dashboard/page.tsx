import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { roleLabels } from "@/lib/constants";

const dashboards: Record<string, { href: string; title: string; description: string }> = {
  COE: { href: "/dashboard/coe", title: "COE Dashboard", description: "Manage users, departments, exam cycles, and audit logs" },
  COORDINATOR: { href: "/dashboard/coordinator", title: "Coordinator Dashboard", description: "Manage subjects, question banks, and teacher assignments" },
  MODERATOR: { href: "/dashboard/moderator", title: "Moderator Dashboard", description: "Review and moderate question submissions" },
  CONTRIBUTOR: { href: "/dashboard/contributor", title: "Contributor Dashboard", description: "Contribute questions and track your submissions" },
  DEAN: { href: "/dashboard/dean", title: "Dean Dashboard", description: "View readiness overview and reports" },
};

export default async function DashboardIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await getCurrentUserFromCookies();
  const params = await searchParams;
  const userDashboard = dashboards[user.role];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Your role-based workspace</p>
      </div>
      {params.denied ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Access Denied. You are signed in as {roleLabels[user.role]}, so the {roleLabels[params.denied as keyof typeof roleLabels] ?? params.denied} workspace is unavailable.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {userDashboard ? (
          <Link key={userDashboard.href} href={userDashboard.href}>
            <Card className="h-full transition-colors hover:bg-[var(--muted)]">
              <CardHeader>
                <CardTitle className="text-lg">{userDashboard.title}</CardTitle>
                <CardDescription>{userDashboard.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
