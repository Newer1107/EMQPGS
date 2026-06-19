import { Role, RecordStatus, QuestionBankPhase, QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

type MetricItem = { label: string; value: string | number };
type AttentionItem = { id: string; title: string; description: string; href: string; severity: "critical" | "warning" | "info" | "success" };
type NextActionItem = AttentionItem & { priority: number };

type AuditedAction = {
  id: string;
  actorName: string;
  action: string;
  entityType: string | null;
  createdAt: Date;
};

type StalledBank = {
  id: string;
  subjectName: string;
  subjectCode: string;
  phase: string;
  updatedAt: Date;
  stalledDays: number;
};

type DeanBottleneck = {
  id: string;
  subjectName: string;
  subjectCode: string;
};

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/coe/academic-setup", label: "Academic Setup" },
  { href: "/dashboard/coe/batches", label: "Batches" },
  { href: "/dashboard/coe/exam-cycles", label: "Exam Cycles" },
  { href: "/dashboard/coe/users", label: "Users" },
  { href: "/dashboard/coe/departments", label: "Departments" },
  { href: "/dashboard/coe/production", label: "Production" },
  { href: "/dashboard/coe/monitoring", label: "Monitoring" },
];

export type CoeDashboardData = {
  title: string;
  description: string;
  metrics: MetricItem[];
  attentionItems: AttentionItem[];
  nextActions: NextActionItem[];
  phaseCounts: Record<string, number>;
  phaseTotal: number;
  stalledBanks: StalledBank[];
  deanBottleneckBanks: DeanBottleneck[];
  coverageCounts: { coordinators: number; moderators: number; contributors: number };
  departmentCount: string | number;
  departmentRows: Array<[string, Record<string, number>]>;
  recentAuditLogs: AuditedAction[];
  navItems: NavItem[];
  readyForExportCount: number;
};

export class CoeDashboardService {
  async getDashboard(): Promise<CoeDashboardData> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      departmentCount,
      activeCycles,
      questionBankCount,
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
      prisma.user.count(),
      prisma.department.count(),
      prisma.examCycle.count({ where: { status: "ACTIVE" as const } }),
      prisma.questionBank.count(),
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

    const metrics: MetricItem[] = [
      { label: "Users", value: userCount },
      { label: "Departments", value: departmentCount },
      { label: "Active Cycles", value: activeCycles },
      { label: "Question Banks", value: questionBankCount },
      { label: "Total Questions", value: totalQuestions },
      { label: "Pending Review", value: pendingReview },
      { label: "Fill Rate", value: `${fillRate}%` },
      { label: "Moderation Backlog", value: moderationPendingCount },
      { label: "Dean Bottlenecks", value: deanBottleneckBanks.length },
    ];

    const attentionItems: AttentionItem[] = [];
    if (stalledBanks.length > 0) {
      attentionItems.push({
        id: "stalled",
        title: `${stalledBanks.length} Stalled Bank${stalledBanks.length > 1 ? "s" : ""}`,
        description: "Not updated in 7+ days. Review and reassign.",
        href: "/dashboard/coe/monitoring",
        severity: "critical",
      });
    }
    if (deanBottleneckBanks.length > 0) {
      attentionItems.push({
        id: "dean-bottleneck",
        title: `${deanBottleneckBanks.length} Bank${deanBottleneckBanks.length > 1 ? "s" : ""} Awaiting Dean Review`,
        description: "Papers generated but dean review not submitted.",
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

    const nextActions: NextActionItem[] = [];
    if (readyForExportCount > 0) {
      nextActions.push({
        id: "export",
        title: `Export ${readyForExportCount} Paper${readyForExportCount > 1 ? "s" : ""}`,
        description: "Ready for export \u2014 complete the production pipeline.",
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
        description: `${coverageCounts.moderators} moderators \u00b7 ${coverageCounts.contributors} contributors. Assign missing roles.`,
        href: "/dashboard/coe/users",
        priority: 3,
        severity: "info",
      });
    }

    return {
      title: "COE Dashboard",
      description: "Controller of Examination \u2014 institutional operations center",
      metrics,
      attentionItems,
      nextActions,
      phaseCounts,
      phaseTotal,
      stalledBanks: stalledBanks.map((b) => ({
        id: b.id,
        subjectName: b.subject.subjectName,
        subjectCode: b.subject.subjectCode,
        phase: b.phase,
        updatedAt: b.updatedAt,
        stalledDays: Math.floor((Date.now() - b.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      deanBottleneckBanks: deanBottleneckBanks.map((b) => ({
        id: b.id,
        subjectName: b.subject.subjectName,
        subjectCode: b.subject.subjectCode,
      })),
      coverageCounts,
      departmentCount,
      departmentRows,
      recentAuditLogs: recentAuditLogs.map((log) => ({
        id: log.id,
        actorName: log.actor?.name ?? "System",
        action: log.action,
        entityType: log.entityType,
        createdAt: log.createdAt,
      })),
      navItems: NAV_ITEMS,
      readyForExportCount,
    };
  }
}
