import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const navItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/coe", label: "COE Dashboard" },
  { href: "/dashboard/coe/users", label: "Users" },
  { href: "/dashboard/coe/departments", label: "Departments" },
  { href: "/dashboard/coe/exam-cycles", label: "Exam Cycles" },
  { href: "/dashboard/coe/audit", label: "Audit" },
  { href: "/dashboard/coordinator", label: "Coordinator" },
  { href: "/dashboard/coordinator/subjects", label: "Subjects" },
  { href: "/dashboard/coordinator/question-banks", label: "Question Banks" },
  { href: "/dashboard/coordinator/assignments", label: "Assignments" },
  { href: "/dashboard/coordinator/questions", label: "Contribution Monitor" },
  { href: "/dashboard/moderator", label: "Moderator" },
  { href: "/dashboard/moderator/questions", label: "Moderation Queue" },
  { href: "/dashboard/contributor", label: "Contributor" },
  { href: "/dashboard/contributor/questions", label: "My Questions" },
  { href: "/dashboard/dean", label: "Dean" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="relative border-r-2 border-[var(--foreground)] px-6 py-8 lg:px-8">
          <div className="editorial-rule-heavy pt-8">
            <p className="page-kicker">Platform</p>
            <h1 className="mt-5 text-[clamp(3rem,6vw,5.5rem)] leading-[0.88]">{APP_NAME}</h1>
            <p className="mt-6 max-w-xs text-sm text-[var(--muted-foreground)]">
              Examination operations, editorially framed in strict monochrome.
            </p>
          </div>
          <div className="my-8 flex items-center gap-4">
            <div className="h-5 w-5 border-2 border-[var(--foreground)]" />
            <div className="h-[4px] flex-1 bg-[var(--foreground)]" />
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block border-b border-[var(--border-light)] px-0 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)] transition-colors duration-100 hover:bg-[var(--foreground)] hover:px-3 hover:text-[var(--background)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-[var(--foreground)] focus-visible:outline-offset-2"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main id="main-content" className="px-4 py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
