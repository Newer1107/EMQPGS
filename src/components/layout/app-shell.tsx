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
  { href: "/dashboard/moderator", label: "Moderator" },
  { href: "/dashboard/contributor", label: "Contributor" },
  { href: "/dashboard/dean", label: "Dean" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Platform</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{APP_NAME}</h1>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
