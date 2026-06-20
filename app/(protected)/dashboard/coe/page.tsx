import { QuestionBankPhase } from "@prisma/client";
import { CoeDashboardService } from "@/modules/coe/dashboard.service";
import { questionBankPhaseLabels } from "@/lib/constants";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import { PrimaryAction } from "@/components/dashboard/primary-action";
import { AttentionSection } from "@/components/dashboard/attention-card";
import { ActionPanel } from "@/components/dashboard/action-panel";
import { WorkflowPipeline, type Bottleneck } from "@/components/dashboard/workflow-pipeline";
import { TaskQueue, type QueueItem } from "@/components/dashboard/task-queue";
import { DepartmentProgress } from "@/components/dashboard/department-progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import {
  Users,
  Building2,
  RefreshCw,
  Database,
  FileQuestion,
  Clock,
  Activity,
  UserCheck,
  Shield,
  BookOpen,
} from "lucide-react";

const phaseOrder: QuestionBankPhase[] = [
  QuestionBankPhase.DRAFTING,
  QuestionBankPhase.MODERATION,
  QuestionBankPhase.APPROVAL,
  QuestionBankPhase.COMPLETE,
];

const phaseColors: Record<string, string> = {
  DRAFTING: "bg-sky-500",
  MODERATION: "bg-amber-500",
  APPROVAL: "bg-violet-500",
  COMPLETE: "bg-emerald-500",
};

export default async function CoeDashboardPage() {
  const data = await new CoeDashboardService().getDashboard();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const totalBanks = data.metrics.find((m) => m.label === "Question Banks")?.value ?? 0;
  const fillRate = data.metrics.find((m) => m.label === "Fill Rate")?.value ?? 0;
  const totalUsers = data.metrics.find((m) => m.label === "Users")?.value ?? 0;
  const activeCyclesCount = data.metrics.find((m) => m.label === "Active Cycles")?.value ?? 0;
  const totalQuestions = data.metrics.find((m) => m.label === "Total Questions")?.value ?? 0;
  const pendingReview = data.metrics.find((m) => m.label === "Pending Review")?.value ?? 0;
  const moderationBacklog = data.metrics.find((m) => m.label === "Moderation Backlog")?.value ?? 0;

  // Split attention: info-level (coverage gaps) → AlertBanner, rest → AttentionSection
  const alertItems = data.attentionItems.filter((i) => i.severity === "info");
  const criticalItems = data.attentionItems.filter((i) => i.severity !== "info");

  // Secondary actions (everything except the primary export action)
  const secondaryActions = data.nextActions
    .filter((a) => a.id !== "export")
    .map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      href: a.href,
      variant: (a.severity === "success"
        ? "success"
        : a.severity === "warning"
          ? "warning"
          : "info") as "success" | "warning" | "info",
    }));

  return (
    <div className="space-y-6">
      {/* ZONE 1: Header — greeting, title, summary badges */}
      <DashboardHeader
        title={data.title}
        description={data.description}
        greeting={greeting}
        summary={[
          { label: "Ready for Export", count: data.readyForExportCount, variant: "success" },
          { label: "Active Cycles", count: activeCyclesCount, variant: "default" },
          { label: "Stalled", count: data.stalledBanks.length, variant: "warning" },
        ]}
      />

      {/* ZONE 2: Alert Banner — coverage gaps (no moderators / no contributors) */}
      {alertItems.length > 0 && (
        <AlertBanner
          items={alertItems.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            href: i.href,
            severity: "info" as const,
          }))}
        />
      )}

      {/* ZONE 3: Primary Action — export or review production */}
      <PrimaryAction
        title={
          data.readyForExportCount > 0
            ? `Export ${data.readyForExportCount} Paper${data.readyForExportCount > 1 ? "s" : ""}`
            : "Review Production"
        }
        description={
          data.readyForExportCount > 0
            ? "Question banks ready for production export"
            : "Review overall production status"
        }
        href="/dashboard/coe/production"
        variant={data.readyForExportCount > 0 ? "success" : "default"}
      />

      {/* ZONE 4: Attention Section — stalled banks & dean bottlenecks */}
      {criticalItems.length > 0 && <AttentionSection items={criticalItems} />}

      {/* ZONE 5: Secondary Actions — dean follow-up, coverage review */}
      {secondaryActions.length > 0 && (
        <ActionPanel actions={secondaryActions} title="Next Steps" />
      )}

      {/* ZONE 6: Task Queue — actionable items for stalled banks, dean bottlenecks, ready for export */}
      {(() => {
        const queueItems: QueueItem[] = [];

        for (const bank of data.stalledBanks) {
          queueItems.push({
            id: `stalled-${bank.id}`,
            title: `${bank.subjectName} (${bank.subjectCode})`,
            subtitle: `Stalled in ${bank.phase} · ${bank.stalledDays} days without update`,
            href: `/dashboard/coordinator/question-banks/${bank.id}`,
            badge: { label: "Stalled", variant: "warning" },
            meta: `${bank.stalledDays}d`,
            metaVariant: "warning",
          });
        }

        for (const bank of data.deanBottleneckBanks) {
          queueItems.push({
            id: `dean-${bank.id}`,
            title: `${bank.subjectName} (${bank.subjectCode})`,
            subtitle: "Awaiting dean review",
            href: "/dashboard/coe/production",
            badge: { label: "Dean Review", variant: "info" },
            meta: "Overdue",
            metaVariant: "danger",
          });
        }

        if (data.readyForExportCount > 0) {
          queueItems.push({
            id: "ready-for-export",
            title: `${data.readyForExportCount} bank${data.readyForExportCount > 1 ? "s" : ""} ready for export`,
            subtitle: "Dean selection completed",
            description: "Ready for production export pipeline",
            href: "/dashboard/coe/production",
            badge: { label: "Ready", variant: "success" },
          });
        }

        return queueItems.length > 0 ? (
          <TaskQueue items={queueItems} title="Action Queue" maxItems={8} />
        ) : null;
      })()}

      {/* ZONE 7: Workflow Pipeline with bottleneck annotations */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Workflow Pipeline</h2>
        <WorkflowPipeline
          phases={phaseOrder.map((p) => ({
            key: p,
            label: questionBankPhaseLabels[p],
            count: data.phaseCounts[p] ?? 0,
            color: phaseColors[p],
          }))}
          total={data.phaseTotal}
          bottlenecks={(() => {
            const b: Bottleneck[] = [];
            if (data.deanBottleneckBanks.length > 0) b.push({ label: "Awaiting Dean Review", count: data.deanBottleneckBanks.length, description: "Papers generated but dean review not submitted", color: "bg-rose-500" });
            if (data.stalledBanks.length > 0) b.push({ label: "Stalled", count: data.stalledBanks.length, description: "Not updated in 7+ days", color: "bg-amber-500" });
            return b;
          })()}
        />
      </div>

      {/* ZONE 8: Department Progress — compact visual rows */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Department Progress</h2>
        <DepartmentProgress
          departments={data.departmentRows.map(([name, phases]) => ({
            name,
            phaseCounts: phases,
            total: Object.values(phases).reduce((s, v) => s + v, 0),
          }))}
          phaseOrder={phaseOrder}
          phaseLabels={questionBankPhaseLabels}
          phaseColors={phaseColors}
        />
      </div>

      {/* ZONE 9: Key Supporting Metrics — compact stat strip */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard value={totalBanks} label="Total Banks" icon={<Database className="h-4 w-4" />} size="sm" />
        <StatCard value={fillRate} label="Fill Rate" icon={<Activity className="h-4 w-4" />} size="sm" />
        <StatCard value={totalUsers} label="Total Users" icon={<Users className="h-4 w-4" />} size="sm" />
        <StatCard value={activeCyclesCount} label="Active Cycles" icon={<RefreshCw className="h-4 w-4" />} size="sm" />
      </div>

      {/* ZONE 10: Recent Activity — timeline format */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Recent Activity</h2>
        <RecentActivity
          events={data.recentAuditLogs.map((log) => ({
            id: log.id,
            timestamp: log.createdAt,
            actor: log.actorName,
            action: log.action,
            target: log.entityType
              ? log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1).toLowerCase()
              : undefined,
            href: "#",
          }))}
          maxEvents={8}
        />
      </div>

      {/* ZONE 11: Compact Footer — remaining supporting metrics */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard value={data.coverageCounts.coordinators} label="Coordinators" icon={<UserCheck className="h-4 w-4" />} size="sm" variant="info" />
        <StatCard value={data.coverageCounts.moderators} label="Moderators" icon={<Shield className="h-4 w-4" />} size="sm" variant="info" />
        <StatCard value={data.coverageCounts.contributors} label="Contributors" icon={<BookOpen className="h-4 w-4" />} size="sm" variant="info" />
        <StatCard value={data.departmentCount} label="Departments" icon={<Building2 className="h-4 w-4" />} size="sm" />
        <StatCard value={totalQuestions} label="Total Questions" icon={<FileQuestion className="h-4 w-4" />} size="sm" />
        <StatCard value={moderationBacklog} label="Moderation Backlog" icon={<Clock className="h-4 w-4" />} size="sm" variant="warning" />
        <StatCard value={pendingReview} label="Pending Review" icon={<FileQuestion className="h-4 w-4" />} size="sm" variant="warning" />
      </div>
    </div>
  );
}
