import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const dashboards = [
  { href: "/dashboard/coe", title: "COE Dashboard", description: "Manage users, departments, exam cycles, and audit logs" },
  { href: "/dashboard/coordinator", title: "Coordinator Dashboard", description: "Manage subjects, question banks, and teacher assignments" },
  { href: "/dashboard/moderator", title: "Moderator Dashboard", description: "Review and moderate question submissions" },
  { href: "/dashboard/contributor", title: "Contributor Dashboard", description: "Contribute questions and track your submissions" },
  { href: "/dashboard/dean", title: "Dean Dashboard", description: "View readiness overview and reports" },
];

export default function DashboardIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Select a role-based workspace to get started</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboards.map((dashboard) => (
          <Link key={dashboard.href} href={dashboard.href}>
            <Card className="h-full transition-colors hover:bg-[var(--muted)]">
              <CardHeader>
                <CardTitle className="text-lg">{dashboard.title}</CardTitle>
                <CardDescription>{dashboard.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
