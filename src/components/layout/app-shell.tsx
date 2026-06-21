"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";

interface NavItem {
  label: string;
  href: string;
  workspaceTypes: string[];
}

type ResponsibilityOption = {
  id: string;
  display: { title: string; subtitle?: string; tertiary?: string };
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", workspaceTypes: ["COE", "COORDINATOR", "MODERATOR", "CONTRIBUTOR", "DEAN"] },
  // COE
  { href: "/dashboard/coe", label: "Overview", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/users", label: "Users", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/departments", label: "Departments", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/exam-cycles", label: "Exam Cycles", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/academic-years", label: "Academic Years", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/monitoring", label: "Monitoring", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/production", label: "Production", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/papers", label: "Paper Publication", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/audit", label: "Audit Log", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/coordinator-assignments", label: "Coordinators", workspaceTypes: ["COE"] },
  // Academic Setup
  { href: "/dashboard/coe/academic-setup", label: "Academic Setup", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/curriculum", label: "Curriculum", workspaceTypes: ["COE"] },
  { href: "/dashboard/coe/batches", label: "Batches", workspaceTypes: ["COE"] },
  // Coordinator
  { href: "/dashboard/coordinator", label: "Coordinator Dashboard", workspaceTypes: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/subjects", label: "Subjects", workspaceTypes: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/question-banks", label: "Question Banks", workspaceTypes: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/assignments", label: "Assignments", workspaceTypes: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/questions", label: "Questions", workspaceTypes: ["COORDINATOR"] },
  { href: "/dashboard/coordinator/coverage", label: "Coverage", workspaceTypes: ["COORDINATOR"] },
  // Moderator
  { href: "/dashboard/moderator", label: "Moderator Dashboard", workspaceTypes: ["MODERATOR"] },
  { href: "/dashboard/moderator/bank", label: "Slot Grid", workspaceTypes: ["MODERATOR"] },
  { href: "/dashboard/moderator/questions", label: "Review Queue", workspaceTypes: ["MODERATOR"] },
  { href: "/dashboard/moderator/approved", label: "Approved", workspaceTypes: ["MODERATOR"] },
  { href: "/dashboard/moderator/rejected", label: "Rejected", workspaceTypes: ["MODERATOR"] },
  // Contributor
  { href: "/dashboard/contributor", label: "Contributor Dashboard", workspaceTypes: ["CONTRIBUTOR"] },
  { href: "/dashboard/contributor/bank", label: "Slot Grid", workspaceTypes: ["CONTRIBUTOR"] },
  { href: "/dashboard/contributor/submit-question", label: "Submit Question", workspaceTypes: ["CONTRIBUTOR"] },
  { href: "/dashboard/contributor/questions", label: "My Submissions", workspaceTypes: ["CONTRIBUTOR"] },
  // Dean
  { href: "/dashboard/dean", label: "Dean Dashboard", workspaceTypes: ["DEAN"] },
  { href: "/dashboard/dean/review", label: "Review Papers", workspaceTypes: ["DEAN"] },
  { href: "/dashboard/dean/readiness-overview", label: "Readiness Overview", workspaceTypes: ["DEAN"] },
  { href: "/dashboard/dean/reports", label: "Reports", workspaceTypes: ["DEAN"] },
];

function getSection(href: string): string {
  if (href === "/dashboard") return "Overview";
  if (
    [
      "/dashboard/coe/academic-setup",
      "/dashboard/coe/curriculum",
      "/dashboard/coe/batches",
    ].includes(href)
  )
    return "Academic";
  if (href.startsWith("/dashboard/coe")) return "Administration";
  if (
    href.startsWith("/dashboard/coordinator") ||
    href.startsWith("/dashboard/moderator") ||
    href.startsWith("/dashboard/dean")
  )
    return "Review";
  if (href.startsWith("/dashboard/contributor")) return "Contributions";
  return "Overview";
}

const sectionOrder = ["Overview", "Administration", "Academic", "Review", "Contributions"];

export function AppShell({
  children,
  userName,
  userEmail,
  workspaceType,
  workspaceTitle,
  workspaceSubtitle,
  workspaceTertiary,
  activeAssignmentId,
  badgeCounts = {},
  responsibilities = [],
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  workspaceType: string;
  workspaceTitle?: string;
  workspaceSubtitle?: string;
  workspaceTertiary?: string;
  activeAssignmentId?: string;
  badgeCounts?: Record<string, number>;
  responsibilities?: ResponsibilityOption[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const filteredNavItems = navItems.filter((item) => item.workspaceTypes.includes(workspaceType));

  const grouped = new Map<string, NavItem[]>();
  for (const item of filteredNavItems) {
    const section = getSection(item.href);
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(item);
  }

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

  const showSwitcher = responsibilities.length > 1;

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col border-r border-[var(--border)] bg-white transition-all duration-200",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn("transition-transform", collapsed && "rotate-180")}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-sm font-bold text-[var(--background)]">
                {APP_NAME[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{APP_NAME}</p>
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">{workspaceTitle ?? workspaceType}</p>
                {workspaceSubtitle && (
                  <p className="truncate text-[11px] text-[var(--text-tertiary)]">{workspaceSubtitle}</p>
                )}
                {workspaceTertiary && (
                  <p className="truncate text-[11px] text-[var(--text-tertiary)] opacity-70">{workspaceTertiary}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Main navigation">
          {sectionOrder.filter((s) => grouped.has(s)).map((section) => {
            const items = grouped.get(section)!;
            return (
              <div key={section} className="mb-5">
                {!collapsed && (
                  <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {section}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    const badge = badgeCounts[item.href];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
                          isActive
                            ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]",
                          collapsed && "justify-center px-0",
                        )}
                      >
                        {collapsed ? (
                          <span className="text-sm font-semibold">{item.label[0]}</span>
                        ) : (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {badge != null && badge > 0 && (
                              <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-medium text-white">
                                {badge > 99 ? "99+" : badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
                {initials}
              </div>
              <button
                onClick={handleLogout}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-elevated)]"
                aria-label="Sign out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--surface-elevated)] px-3 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{userName}</p>
                  <p className="truncate text-xs text-[var(--text-tertiary)]">{userEmail}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]"
                onClick={handleLogout}
              >
                Sign out
              </Button>
            </>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-center justify-between px-6 py-3">
            <Breadcrumbs />
            <div className="flex items-center gap-3">
              {showSwitcher && (
                <WorkspaceSwitcher
                  currentAssignmentId={activeAssignmentId}
                  workspaces={responsibilities.map((r) => ({
                    id: r.id,
                    display: r.display,
                  }))}
                />
              )}
              <span className="text-sm text-[var(--text-tertiary)]">{userEmail}</span>
              <span className="block h-2 w-2 rounded-full bg-red-500" aria-label="Unread notifications" />
            </div>
          </div>
        </header>
        <main id="main-content" className="flex-1 bg-[var(--surface-hover)]">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
