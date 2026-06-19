import { Role, RecordStatus, QuestionBankPhase, QuestionStatus } from "@prisma/client";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { MetricTile } from "@/components/ui/metric-tile";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NextActions } from "@/components/dashboard/next-actions";
import { AttentionSection } from "@/components/dashboard/attention-card";
import { getDashboardSeed } from "@/lib/server-data";
import { prisma } from "@/lib/db";
import { questionBankPhaseLabels } from "@/lib/constants";
import {
  Users, Building2, RefreshCw, Database, FileQuestion, Clock,
  Activity, ArrowRight, GraduationCap, BookOpen, UserCheck,
  Building, Shield, Monitor, AlertTriangle, Layers, CheckCircle2,
} from "lucide-react";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

const phaseOrder: QuestionBankPhase[] = [
  QuestionBankPhase.DRAFTING,
  QuestionBankPhase.MODERATION,
  QuestionBankPhase.APPROVAL,
  QuestionBankPhase.COMPLETE,
];

export default async function CoeDashboardPage() {
  const data = await getDashboardSeed(Role.COE);
  if (!data) return null;

  // eslint-disable-next-line react-hooks/purity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalQuestions,
    pendingReview,
    recentAuditLogs,
    phaseDistribution,
    patternAgg,
    filledSlotCount,
    stalledBanks,
    allBanksWithDept,
    moderationPendingCount,
    deanBottleneckBanks,
    userRoleCounts,
  ] = await Promise.all([
    prisma.questionLibraryItem.count(),
    prisma.questionLibraryItem.count({
      where: { status: { in: ["PENDING", "REVISION_SUBMITTED"] } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
    prisma.questionBank.groupBy({ by: ["phase"], _count: true }),
    prisma.paperPattern.aggregate({ _sum: { totalSlots: true } }),
    prisma.questionSlot.count({ where: { assignedQuestionId: { not: null } } }),
    prisma.questionBank.findMany({
      where: { updatedAt: { lt: sevenDaysAgo }, phase: { not: QuestionBankPhase.COMPLETE } },
      include: { subject: { select: { subjectName: true, subjectCode: true } } },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.questionBank.findMany({
      include: { subject: { include: { department: true } } },
    }),
    prisma.questionLibraryItem.count({ where: { status: QuestionStatus.PENDING } }),
    prisma.questionBank.findMany({
      where: { generatedPapers: { some: {} }, deanReview: null },
      include: { subject: { select: { subjectName: true, subjectCode: true } } },
    }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
  ]);

  const totalSlots = patternAgg._sum.totalSlots ?? 0;
  const fillRate = totalSlots > 0 ? Math.round((filledSlotCount / totalSlots) * 100) : 0;

  const readyForExportCount = allBanksWithDept.filter(
    (b) => b.phase === QuestionBankPhase.COMPLETE && b.recordStatus !== RecordStatus.LOCKED,
  ).length;

  const coverageCounts = {
    moderators: userRoleCounts.find((r) => r.role === Role.MODERATOR)?._count ?? 0,
    contributors: userRoleCounts.find((r) => r.role === Role.CONTRIBUTOR)?._count ?? 0,
    coordinators: userRoleCounts.find((r) => r.role === Role.COORDINATOR)?._count ?? 0,
  };

  const phaseCounts: Record<string, number> = {};
  let phaseTotal = 0;
  for (const item of phaseDistribution) {
    phaseCounts[item.phase] = item._count;
    phaseTotal += item._count;
  }

  const deptPhaseMap = new Map<string, Record<string, number>>();
  for (const bank of allBanksWithDept) {
    const deptName = bank.subject.department.name;
    let row = deptPhaseMap.get(deptName);
    if (!row) {
      row = { DRAFTING: 0, MODERATION: 0, APPROVAL: 0, COMPLETE: 0 };
      deptPhaseMap.set(deptName, row);
    }
    row[bank.phase]++;
  }
  const departmentRows = Array.from(deptPhaseMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const metricIcons = [Users, Building2, RefreshCw, Database, FileQuestion, Clock, Database, Clock, Shield];
  const metrics = [
    ...data.stats,
    { label: "Total Questions", value: totalQuestions },
    { label: "Pending Review", value: pendingReview },
    { label: "Fill Rate", value: `${fillRate}%` },
    { label: "Moderation Backlog", value: moderationPendingCount },
    { label: "Dean Bottlenecks", value: deanBottleneckBanks.length },
  ];

  const navItems = [
    { href: "/dashboard/coe/academic-setup", label: "Academic Setup", icon: GraduationCap },
    { href: "/dashboard/coe/batches", label: "Batches", icon: BookOpen },
    { href: "/dashboard/coe/exam-cycles", label: "Exam Cycles", icon: RefreshCw },
    { href: "/dashboard/coe/users", label: "Users", icon: UserCheck },
    { href: "/dashboard/coe/departments", label: "Departments", icon: Building },
    { href: "/dashboard/coe/production", label: "Production", icon: Shield },
    { href: "/dashboard/coe/monitoring", label: "Monitoring", icon: Monitor },
  ];

  const departmentCount = data.stats.find((s) => s.label === "Departments")?.value ?? "—";

  // Attention items
  const attentionItems: Array<{ id: string; title: string; description: string; href: string; severity: "critical" | "warning" | "info" | "success" }> = [];
  if (stalledBanks.length > 0) {
    attentionItems.push({
      id: "stalled",
      title: `${stalledBanks.length} Stalled Bank${stalledBanks.length > 1 ? "s" : ""}`,
      description: `Not updated in 7+ days. Review and reassign.`,
      href: "/dashboard/coe/monitoring",
      severity: "critical",
    });
  }
  if (deanBottleneckBanks.length > 0) {
    attentionItems.push({
      id: "dean-bottleneck",
      title: `${deanBottleneckBanks.length} Bank${deanBottleneckBanks.length > 1 ? "s" : ""} Awaiting Dean Review`,
      description: `Papers generated but dean review not submitted.`,
      href: "/dashboard/coe/production",
      severity: "warning",
    });
  }
  if (coverageCounts.moderators === 0) {
    attentionItems.push({
      id: "no-moderators",
      title: "No Moderators Available",
      description: "Assign moderators to departments to enable moderation phase progress.",
      href: "/dashboard/coe/users",
      severity: "info",
    });
  }
  if (coverageCounts.contributors === 0) {
    attentionItems.push({
      id: "no-contributors",
      title: "No Contributors Available",
      description: "Assign contributors to departments to enable drafting phase progress.",
      href: "/dashboard/coe/users",
      severity: "info",
    });
  }

  // Next actions
  const nextActions: Array<{ id: string; title: string; description: string; href: string; priority: number; severity: "critical" | "warning" | "info" | "success" }> = [];
  if (readyForExportCount > 0) {
    nextActions.push({
      id: "export",
      title: `Export ${readyForExportCount} Paper${readyForExportCount > 1 ? "s" : ""}`,
      description: `Ready for export — complete the production pipeline.`,
      href: "/dashboard/coe/production",
      priority: 1,
      severity: "success",
    });
  }
  if (deanBottleneckBanks.length > 0) {
    nextActions.push({
      id: "dean-push",
      title: "Follow Up on Dean Reviews",
      description: `${deanBottleneckBanks.length} bank${deanBottleneckBanks.length > 1 ? "s" : ""} stuck waiting for dean.`,
      href: "/dashboard/coe/production",
      priority: 2,
      severity: "warning",
    });
  }
  if (coverageCounts.moderators === 0 || coverageCounts.contributors === 0) {
    nextActions.push({
      id: "coverage",
      title: "Review User Coverage",
      description: `${coverageCounts.moderators} moderators · ${coverageCounts.contributors} contributors. Assign missing roles.`,
      href: "/dashboard/coe/users",
      priority: 3,
      severity: "info",
    });
  }

  return (
    <div className="space-y-6">
      {/* ZONE 1 */}
      <PageHeader
        title="COE Dashboard"
        description="Controller of Examination — institutional operations center"
      />

      {/* ZONE 2: What Needs My Attention */}
      <AttentionSection items={attentionItems} />

      {/* ZONE 3: What Should I Do Next */}
      <NextActions actions={nextActions} max={3} />

      {/* ZONE 4: Current Workload */}
      {/* Workflow pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--text-tertiary)]" />
            Workflow Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex h-5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
            {phaseOrder.map((phase) => {
              const count = phaseCounts[phase] ?? 0;
              const pct = phaseTotal > 0 ? (count / phaseTotal) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={phase}
                  className="transition-all"
                  style={{ width: `${pct}%` }}
                  title={`${questionBankPhaseLabels[phase]}: ${count}`}
                >
                  <div className={phase === QuestionBankPhase.DRAFTING ? "bg-sky-500 h-full" : phase === QuestionBankPhase.MODERATION ? "bg-amber-500 h-full" : phase === QuestionBankPhase.APPROVAL ? "bg-violet-500 h-full" : "bg-emerald-500 h-full"} />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {phaseOrder.map((phase) => {
              const count = phaseCounts[phase] ?? 0;
              const pct = phaseTotal > 0 ? Math.round((count / phaseTotal) * 100) : 0;
              return (
                <div key={phase} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${phase === QuestionBankPhase.DRAFTING ? "bg-sky-500" : phase === QuestionBankPhase.MODERATION ? "bg-amber-500" : phase === QuestionBankPhase.APPROVAL ? "bg-violet-500" : "bg-emerald-500"}`} />
                  <span className="text-[var(--text-secondary)] font-medium">
                    {questionBankPhaseLabels[phase]}
                  </span>
                  <span className="text-[var(--text-tertiary)]">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="text-[var(--text-secondary)] font-medium">Awaiting Dean Review</span>
              <span className="text-[var(--text-tertiary)]">{deanBottleneckBanks.length} banks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-[var(--text-secondary)] font-medium">Ready for Export</span>
              <span className="text-[var(--text-tertiary)]">{readyForExportCount} banks</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric tiles */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m, i) => {
          const Icon = metricIcons[i] ?? Activity;
          return <MetricTile key={m.label} icon={<Icon className="h-5 w-5" />} value={m.value} label={m.label} />;
        })}
      </div>

      {/* ZONE 5: Everything Else */}
      {/* Stalled Banks + Dean Bottleneck — compact row */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--text-tertiary)]" />
              Stalled Banks
              {stalledBanks.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {stalledBanks.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stalledBanks.length === 0 ? (
              <EmptyState title="No stalled banks" description="All active banks have been updated within the last 7 days" />
            ) : (
              <div className="space-y-2">
                {stalledBanks.map((bank) => {
                  const stalled = daysSince(bank.updatedAt);
                  return (
                    <div key={bank.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-[var(--text-primary)]">{bank.subject.subjectName}</span>
                        <span className="ml-2 text-xs text-[var(--text-tertiary)]">{bank.subject.subjectCode}</span>
                        <span className="ml-2 inline-block rounded bg-[var(--surface-secondary)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                          {questionBankPhaseLabels[bank.phase]}
                        </span>
                      </div>
                      <span className="shrink-0 ml-3 text-xs font-medium text-amber-600 dark:text-amber-400">{stalled}d stalled</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--text-tertiary)]" />
              Pending Dean Review
              {deanBottleneckBanks.length > 0 && (
                <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {deanBottleneckBanks.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deanBottleneckBanks.length === 0 ? (
              <EmptyState title="No dean bottlenecks" description="All generated papers have been reviewed." />
            ) : (
              <div className="space-y-2">
                {deanBottleneckBanks.map((bank) => (
                  <div key={bank.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[var(--text-primary)]">{bank.subject.subjectName}</span>
                      <span className="ml-2 text-xs text-[var(--text-tertiary)]">{bank.subject.subjectCode}</span>
                    </div>
                    <span className="shrink-0 ml-3 text-xs text-[var(--text-tertiary)]">Papers ready</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coverage summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricTile icon={<Users className="h-5 w-5" />} value={coverageCounts.coordinators} label="Coordinators" />
        <MetricTile icon={<UserCheck className="h-5 w-5" />} value={coverageCounts.moderators} label="Moderators" />
        <MetricTile icon={<FileQuestion className="h-5 w-5" />} value={coverageCounts.contributors} label="Contributors" />
        <MetricTile icon={<Building2 className="h-5 w-5" />} value={departmentCount} label="Departments" />
      </div>

      {/* Department Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--text-tertiary)]" />
            Department Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {departmentRows.length === 0 ? (
            <EmptyState title="No bank data" description="Question banks will appear here once created" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-tertiary)]">
                  <th className="pb-2 pr-4 font-medium">Department</th>
                  {phaseOrder.map((phase) => (
                    <th key={phase} className="pb-2 px-3 font-medium text-center">
                      {questionBankPhaseLabels[phase]}
                    </th>
                  ))}
                  <th className="pb-2 pl-3 font-medium text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {departmentRows.map(([dept, phases]) => {
                  const total = Object.values(phases).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={dept} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-[var(--text-primary)]">{dept}</td>
                      {phaseOrder.map((phase) => (
                        <td key={phase} className="py-2.5 px-3 text-center text-[var(--text-secondary)]">
                          {phases[phase] || "—"}
                        </td>
                      ))}
                      <td className="py-2.5 pl-3 text-center font-semibold text-[var(--text-primary)]">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Recent activity + Quick nav */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--text-tertiary)]" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAuditLogs.length === 0 ? (
              <EmptyState title="No recent activity" description="Audit log entries will appear here" />
            ) : (
              <div className="space-y-3">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <Activity className="mt-0.5 h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{log.actor?.name ?? "System"}</span>
                      <span className="text-[var(--text-tertiary)]"> {log.action}</span>
                      {log.entityType && (
                        <span className="text-[var(--text-tertiary)]">
                          {" "}on {log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1).toLowerCase()}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[var(--text-tertiary)]">{timeAgo(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick Navigation</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-3"
                  >
                    <Icon className="h-5 w-5 text-[var(--text-tertiary)] shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                    <ArrowRight className="ml-auto h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
