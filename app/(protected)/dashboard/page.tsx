import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { roleLabels } from "@/lib/constants";

const roleByHref: Record<string, string> = {
  "/dashboard/coe": "COE",
  "/dashboard/coordinator": "COORDINATOR",
  "/dashboard/moderator": "MODERATOR",
  "/dashboard/contributor": "CONTRIBUTOR",
  "/dashboard/dean": "DEAN",
};

const dashboards = [
  { href: "/dashboard/coe", title: "COE Dashboard", description: "Manage users, departments, exam cycles, and audit logs" },
  { href: "/dashboard/coordinator", title: "Coordinator Dashboard", description: "Manage subjects, question banks, and teacher assignments" },
  { href: "/dashboard/moderator", title: "Moderator Dashboard", description: "Review and moderate question submissions" },
  { href: "/dashboard/contributor", title: "Contributor Dashboard", description: "Contribute questions and track your submissions" },
  { href: "/dashboard/dean", title: "Dean Dashboard", description: "View readiness overview and reports" },
];

export default async function DashboardIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await getCurrentUserFromCookies();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Select a role-based workspace to get started</p>
      </div>
      {params.denied ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Access Denied. You are signed in as {roleLabels[user.role]}, so the {roleLabels[params.denied as keyof typeof roleLabels] ?? params.denied} workspace is unavailable.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboards.map((dashboard) => (
          <Link
            key={dashboard.href}
            href={roleByHref[dashboard.href] === user.role ? dashboard.href : `/dashboard?denied=${roleByHref[dashboard.href]}`}
          >
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
