"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  coe: "COE",
  coordinator: "Coordinator",
  moderator: "Moderator",
  contributor: "Contributor",
  dean: "Dean",
  users: "Users",
  departments: "Departments",
  "exam-cycles": "Exam Cycles",
  "academic-years": "Academic Years",
  monitoring: "Monitoring",
  production: "Production",
  audit: "Audit Log",
  "coordinator-assignments": "Coordinator Assignments",
  "academic-setup": "Academic Setup",
  "academic-units": "Academic Units",
  programmes: "Programmes",
  curriculum: "Curriculum",
  batches: "Batches",
  semesters: "Semesters",
  "teaching-groups": "Teaching Groups",
  subjects: "Subjects",
  "question-banks": "Question Banks",
  assignments: "Assignments",
  questions: "Questions",
  coverage: "Coverage",
  "my-subjects": "My Subjects",
  "submit-question": "Submit Question",
  "my-submissions": "My Submissions",
  "review-queue": "Review Queue",
  approved: "Approved",
  rejected: "Rejected",
  review: "Review Papers",
  "readiness-overview": "Readiness Overview",
  reports: "Reports",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = routeLabels[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
          {crumb.isLast ? (
            <span className="font-medium text-[var(--foreground)]">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-[var(--foreground)] transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
