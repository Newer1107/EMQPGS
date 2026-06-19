import { QuestionBankPhase } from "@prisma/client";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { MetricTile } from "@/components/ui/metric-tile";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NextActions } from "@/components/dashboard/next-actions";
import { AttentionSection } from "@/components/dashboard/attention-card";
import { CoeDashboardService } from "@/modules/coe/dashboard.service";
import { questionBankPhaseLabels } from "@/lib/constants";
import { timeAgo } from "@/lib/dashboard-utils";
import {
  Users, Building2, RefreshCw, Database, FileQuestion, Clock,
  Activity, ArrowRight, GraduationCap, BookOpen, UserCheck,
  Building, Shield, Monitor, AlertTriangle, Layers,
} from "lucide-react";

const phaseOrder: QuestionBankPhase[] = [
  QuestionBankPhase.DRAFTING,
  QuestionBankPhase.MODERATION,
  QuestionBankPhase.APPROVAL,
  QuestionBankPhase.COMPLETE,
];

const metricIcons: Array<React.ElementType> = [
  Users, Building2, RefreshCw, Database, FileQuestion, Clock, Database, Clock, Shield,
];

export default async function CoeDashboardPage() {
  const data = await new CoeDashboardService().getDashboard();

  return (
    <div className="space-y-6">
      {/* ZONE 1 */}
      <PageHeader title={data.title} description={data.description} />

      {/* ZONE 2: What Needs My Attention */}
      <AttentionSection items={data.attentionItems} />

      {/* ZONE 3: What Should I Do Next */}
      <NextActions actions={data.nextActions} max={3} />

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
              const count = data.phaseCounts[phase] ?? 0;
              const pct = data.phaseTotal > 0 ? (count / data.phaseTotal) * 100 : 0;
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
              const count = data.phaseCounts[phase] ?? 0;
              const pct = data.phaseTotal > 0 ? Math.round((count / data.phaseTotal) * 100) : 0;
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
              <span className="text-[var(--text-tertiary)]">{data.deanBottleneckBanks.length} banks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-[var(--text-secondary)] font-medium">Ready for Export</span>
              <span className="text-[var(--text-tertiary)]">{data.readyForExportCount} banks</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric tiles */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {data.metrics.map((m, i) => {
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
              {data.stalledBanks.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {data.stalledBanks.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.stalledBanks.length === 0 ? (
              <EmptyState title="No stalled banks" description="All active banks have been updated within the last 7 days" />
            ) : (
              <div className="space-y-2">
                {data.stalledBanks.map((bank) => (
                  <div key={bank.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[var(--text-primary)]">{bank.subjectName}</span>
                      <span className="ml-2 text-xs text-[var(--text-tertiary)]">{bank.subjectCode}</span>
                      <span className="ml-2 inline-block rounded bg-[var(--surface-secondary)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                        {questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}
                      </span>
                    </div>
                    <span className="shrink-0 ml-3 text-xs font-medium text-amber-600 dark:text-amber-400">{bank.stalledDays}d stalled</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--text-tertiary)]" />
              Pending Dean Review
              {data.deanBottleneckBanks.length > 0 && (
                <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {data.deanBottleneckBanks.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.deanBottleneckBanks.length === 0 ? (
              <EmptyState title="No dean bottlenecks" description="All generated papers have been reviewed." />
            ) : (
              <div className="space-y-2">
                {data.deanBottleneckBanks.map((bank) => (
                  <div key={bank.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[var(--text-primary)]">{bank.subjectName}</span>
                      <span className="ml-2 text-xs text-[var(--text-tertiary)]">{bank.subjectCode}</span>
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
        <MetricTile icon={<Users className="h-5 w-5" />} value={data.coverageCounts.coordinators} label="Coordinators" />
        <MetricTile icon={<UserCheck className="h-5 w-5" />} value={data.coverageCounts.moderators} label="Moderators" />
        <MetricTile icon={<FileQuestion className="h-5 w-5" />} value={data.coverageCounts.contributors} label="Contributors" />
        <MetricTile icon={<Building2 className="h-5 w-5" />} value={data.departmentCount} label="Departments" />
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
          {data.departmentRows.length === 0 ? (
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
                {data.departmentRows.map(([dept, phases]) => {
                  const total = Object.values(phases).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={dept} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-[var(--text-primary)]">{dept}</td>
                      {phaseOrder.map((phase) => (
                        <td key={phase} className="py-2.5 px-3 text-center text-[var(--text-secondary)]">
                          {phases[phase] || "\u2014"}
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
            {data.recentAuditLogs.length === 0 ? (
              <EmptyState title="No recent activity" description="Audit log entries will appear here" />
            ) : (
              <div className="space-y-3">
                {data.recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <Activity className="mt-0.5 h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{log.actorName}</span>
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
              {data.navItems.map((item) => {
                const iconMap: Record<string, React.ElementType> = {
                  "Academic Setup": GraduationCap,
                  "Batches": BookOpen,
                  "Exam Cycles": RefreshCw,
                  "Users": UserCheck,
                  "Departments": Building,
                  "Production": Shield,
                  "Monitoring": Monitor,
                };
                const Icon = iconMap[item.label] ?? Activity;
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
