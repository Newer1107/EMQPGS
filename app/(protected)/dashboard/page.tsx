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
    <div className="space-y-10">
      <div className="section-frame">
        <p className="page-kicker">Role Navigation</p>
        <h1 className="page-display mt-4 max-w-5xl">ADMINISTRATIVE FOUNDATION</h1>
        <p className="page-lead mt-8">Phase 1 and the contribution workflow are structured into role-based editorial workspaces with sharp hierarchy and strict operational boundaries.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {dashboards.map((dashboard) => (
          <Link key={dashboard.href} href={dashboard.href}>
            <Card className="h-full border-2 border-[var(--foreground)] transition-colors duration-100 hover:bg-[var(--foreground)] hover:text-[var(--background)]">
              <CardHeader>
                <p className="page-kicker">Workspace</p>
                <CardTitle className="mt-2 text-4xl">{dashboard.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-base text-[var(--muted-foreground)]">{dashboard.description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
