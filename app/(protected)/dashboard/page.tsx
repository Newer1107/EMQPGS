import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const dashboards = [
  { href: "/dashboard/coe", title: "COE Dashboard", description: "User, department, cycle, and audit controls." },
  { href: "/dashboard/coordinator", title: "Coordinator Dashboard", description: "Subjects, banks, and assignment workflows." },
  { href: "/dashboard/moderator", title: "Moderator Dashboard", description: "Moderation pipeline and pending reviews." },
  { href: "/dashboard/contributor", title: "Contributor Dashboard", description: "Contribution tasks and deadlines." },
  { href: "/dashboard/dean", title: "Dean Dashboard", description: "Approval visibility and readiness overview." },
];

export default function DashboardIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Administrative Platform Foundation</h1>
        <p className="mt-2 text-slate-600">Phase 1 is organized into role-specific operational dashboards.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboards.map((dashboard) => (
          <Link key={dashboard.href} href={dashboard.href}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <CardTitle>{dashboard.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">{dashboard.description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
