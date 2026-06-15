"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", roles: ["COE", "COORDINATOR", "MODERATOR", "CONTRIBUTOR", "DEAN"] },
  // COE
  { href: "/dashboard/coe", label: "COE Dashboard", roles: ["COE"] },
  { href: "/dashboard/coe/users", label: "Users", roles: ["COE"] },
  { href: "/dashboard/coe/departments", label: "Departments", roles: ["COE"] },
  { href: "/dashboard/coe/exam-cycles", label: "Exam Cycles", roles: ["COE"] },
  { href: "/dashboard/coe/academic-years", label: "Academic Years", roles: ["COE"] },
  { href: "/dashboard/coe/semesters", label: "Semesters", roles: ["COE"] },
  { href: "/dashboard/coe/monitoring", label: "Monitoring", roles: ["COE"] },
  { href: "/dashboard/coe/production", label: "Production", roles: ["COE"] },
  { href: "/dashboard/coe/audit", label: "Audit Log", roles: ["COE"] },
  // Coordinator
  { href: "/dashboard/coordinator", label: "Coordinator Dashboard", roles: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/subjects", label: "Subjects", roles: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/question-banks", label: "Question Banks", roles: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/assignments", label: "Assignments", roles: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/questions", label: "Questions", roles: ["COORDINATOR"] },
  // Moderator
  { href: "/dashboard/moderator", label: "Moderator Dashboard", roles: ["MODERATOR"] },
  { href: "/dashboard/moderator/questions", label: "Review Queue", roles: ["MODERATOR"] },
  { href: "/dashboard/moderator/signed-reports", label: "Signed Reports", roles: ["MODERATOR"] },
  // Contributor
  { href: "/dashboard/contributor", label: "Contributor Dashboard", roles: ["CONTRIBUTOR"] },
  { href: "/dashboard/contributor/my-subjects", label: "My Subjects", roles: ["CONTRIBUTOR"] },
  { href: "/dashboard/contributor/submit-question", label: "Submit Question", roles: ["CONTRIBUTOR"] },
  { href: "/dashboard/contributor/questions", label: "My Submissions", roles: ["CONTRIBUTOR"] },
  // Dean
  { href: "/dashboard/dean", label: "Dean Dashboard", roles: ["DEAN"] },
];

const roleLabels: Record<string, string> = {
  COE: "Controller of Examination",
  COORDINATOR: "Coordinator",
  MODERATOR: "Moderator",
  CONTRIBUTOR: "Contributor",
  DEAN: "Dean",
};

export function AppShell({
  children,
  role,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  role: string;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const filteredNavItems = navItems.filter((item) => item.roles.includes(role));

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Proceed with redirect even if the logout request fails
    }
    router.push("/login");
  }

  const initials = userName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-[var(--border)] bg-white">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--foreground)] text-sm font-bold text-[var(--background)]">
            {APP_NAME[0]}
          </div>
          <div>
            <p className="text-sm font-semibold">{APP_NAME}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{roleLabels[role] ?? role}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                    ? "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    : "bg-transparent text-gray-800 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--muted)] px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">{userName}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">{userEmail}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-sm text-[var(--foreground)] hover:bg-gray-100" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </aside>
      <main id="main-content" className="flex-1 bg-[var(--muted)]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
