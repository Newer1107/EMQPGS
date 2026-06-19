import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { getContributorAssignedBanks } from "@/lib/server-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AlertBanner } from "@/components/dashboard/alert-banner";
import { PrimaryAction } from "@/components/dashboard/primary-action";
import { AttentionSection } from "@/components/dashboard/attention-card";
import { ProgressSummary } from "@/components/dashboard/progress-summary";
import { StatCard } from "@/components/dashboard/stat-card";
import { questionBankPhaseLabels, questionStatusLabels } from "@/lib/constants";
import {
  FileQuestion,
  CheckCircle2,
  Clock,
  XCircle,
  FileEdit,
  RefreshCw,
  PenSquare,
  Eye,
  AlertTriangle,
  Layers,
  ListTodo,
} from "lucide-react";

const OVERDUE_DAYS = 3;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function statIcon(label: string): React.ReactNode {
  const icons: Record<string, React.ElementType> = {
    Submitted: FileQuestion,
    Approved: CheckCircle2,
    Pending: Clock,
    "Revision Requested": RefreshCw,
    Rejected: XCircle,
    Draft: FileEdit,
  };
  const Icon = icons[label] ?? FileQuestion;
  return <Icon className="h-4 w-4" />;
}

export default async function ContributorDashboardPage() {
  const actor = await getCurrentUserFromCookies();
  const banks = await getContributorAssignedBanks(actor.id);

  const [myQuestions] = await Promise.all([
    prisma.questionLibraryItem.findMany({
      where: { createdById: actor.id },
      include: {
        subjectVersion: { include: { subject: true } },
        moderationEvents: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const banksWithSlots = banks.map((b) => ({
    ...b,
    emptySlotCount: b.slots.filter((s) => !s.assignedQuestion).length,
  }));

  const totalEmptySlots = banksWithSlots.reduce((sum, b) => sum + b.emptySlotCount, 0);

  const stats = {
    submitted: myQuestions.filter((q) => q.status !== "DRAFT").length,
    approved: myQuestions.filter((q) => q.status === "APPROVED").length,
    pending: myQuestions.filter((q) => q.status === "PENDING" || q.status === "REVISION_SUBMITTED").length,
    revisionRequested: myQuestions.filter((q) => q.status === "REVISION_REQUESTED").length,
    rejected: myQuestions.filter((q) => q.status === "REJECTED").length,
    draft: myQuestions.filter((q) => q.status === "DRAFT").length,
  };

  const revisionQuestions = myQuestions.filter((q) => q.status === "REVISION_REQUESTED");
  const now = Date.now();
  const overdueCount = revisionQuestions.filter(
    (q) => now - q.updatedAt.getTime() > OVERDUE_DAYS * 24 * 60 * 60 * 1000,
  ).length;

  const recentFeedback = myQuestions
    .filter((q) => q.moderationEvents.length > 0 && q.moderationEvents[0].note)
    .slice(0, 10);

  const sortedByNeed = [...banksWithSlots].sort((a, b) => b.emptySlotCount - a.emptySlotCount);
  const topNeededBank = sortedByNeed[0]?.emptySlotCount > 0 ? sortedByNeed[0] : null;
  const topSvid = topNeededBank?.subject.versions[0]?.id;

  // --- Attention items (revision requests + empty slots) ---
  const attentionItems: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
    severity: "critical" | "warning" | "info" | "success";
  }> = [];

  if (revisionQuestions.length > 0) {
    attentionItems.push({
      id: "revision-requests",
      title: `${revisionQuestions.length} Revision Request${revisionQuestions.length > 1 ? "s" : ""}`,
      description: overdueCount > 0
        ? `${overdueCount} overdue — please update and resubmit`
        : "Questions awaiting your updates",
      href: "/dashboard/contributor/questions",
      severity: overdueCount > 0 ? "critical" : "warning",
    });
  }

  if (totalEmptySlots > 0) {
    attentionItems.push({
      id: "empty-slots",
      title: `${totalEmptySlots} Slot${totalEmptySlots > 1 ? "s" : ""} Need Question${totalEmptySlots > 1 ? "s" : ""}`,
      description: `Across ${banks.length} bank${banks.length > 1 ? "s" : ""}`,
      href: "/dashboard/contributor/submit-question",
      severity: "warning",
    });
  }

  // --- Alert banner data (overdue only) ---
  const alertBannerItems: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
    severity: "critical" | "warning" | "info" | "success";
  }> = [];

  if (overdueCount > 0) {
    alertBannerItems.push({
      id: "overdue-revisions",
      title: `${overdueCount} Overdue Revision${overdueCount > 1 ? "s" : ""}`,
      description: `Revision${overdueCount > 1 ? "s have" : " has"} been pending for over ${OVERDUE_DAYS} days. Please update and resubmit.`,
      href: "/dashboard/contributor/questions",
      severity: "critical",
    });
  }

  // --- Progress bars data ---
  const progressBars = banksWithSlots.map((b) => ({
    label: b.subject.subjectName,
    current: b.slots.filter((s) => s.assignedQuestion).length,
    total: b.slots.length,
  }));

  // --- Stat cards ---
  const statItems = [
    { label: "Submitted", value: stats.submitted },
    { label: "Approved", value: stats.approved },
    { label: "Pending", value: stats.pending },
    { label: "Revision Requested", value: stats.revisionRequested },
    { label: "Rejected", value: stats.rejected },
    { label: "Draft", value: stats.draft },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header */}
      <DashboardHeader
        title="Contributor Dashboard"
        greeting={`${greeting()}, ${actor.name}`}
        summary={[
          { label: "Banks", count: banks.length, icon: <Layers className="h-3.5 w-3.5" /> },
          { label: "Empty Slots", count: totalEmptySlots, icon: <ListTodo className="h-3.5 w-3.5" />, variant: totalEmptySlots > 0 ? "warning" : "success" },
          { label: "Revisions", count: revisionQuestions.length, icon: <RefreshCw className="h-3.5 w-3.5" />, variant: overdueCount > 0 ? "danger" : revisionQuestions.length > 0 ? "warning" : "success" },
        ]}
      />

      {/* 2. Alert Banner — overdue revisions */}
      {alertBannerItems.length > 0 && <AlertBanner items={alertBannerItems} />}

      {/* 3. Primary Action — continue writing top-needed bank */}
      {topNeededBank && (
        <PrimaryAction
          title={`Continue Writing ${topNeededBank.subject.subjectName}`}
          description={`${topNeededBank.emptySlotCount} empty slot${topNeededBank.emptySlotCount > 1 ? "s" : ""} — highest need`}
          href={`/dashboard/contributor/submit-question?subjectVersionId=${topSvid ?? ""}`}
          icon={<PenSquare className="h-4 w-4" />}
          variant="warning"
        />
      )}

      {/* 4. Attention Section — remaining attention items */}
      <AttentionSection
        items={attentionItems}
        emptyMessage="No items need your attention right now."
        title="What Needs My Attention"
      />

      {/* 5. Revision Requests — inline list with overdue badges */}
      {revisionQuestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[var(--warning)]">
              <RefreshCw className="h-4 w-4" />
              Revision Needed ({revisionQuestions.length})
              {overdueCount > 0 && (
                <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  {overdueCount} overdue
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {revisionQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{q.subjectVersion.subject.subjectName}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Module {q.moduleNumber} &middot; {q.marks} marks
                    {now - q.updatedAt.getTime() > OVERDUE_DAYS * 24 * 60 * 60 * 1000 && (
                      <span className="ml-2 font-medium text-red-500">Overdue</span>
                    )}
                  </p>
                </div>
                <Link href={`/dashboard/contributor/questions/${q.id}/edit`}>
                  <Button size="sm" variant="outline">Edit</Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 6. Progress Summary — all assigned banks */}
      {banks.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              title="No subjects assigned"
              description="You have not been assigned to any question banks. Contact your coordinator to get started."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progress Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressSummary bars={progressBars} />
          </CardContent>
        </Card>
      )}

      {/* 7. Recent Feedback */}
      {recentFeedback.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentFeedback.map((q) => (
              <div key={q.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{q.subjectVersion.subject.subjectName}</p>
                  <Badge>{questionStatusLabels[q.status as keyof typeof questionStatusLabels] ?? q.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                  Module {q.moduleNumber} &middot; {q.marks} marks
                </p>
                {q.moderationEvents[0]?.note && (
                  <p className="mt-2 text-sm italic border-l-2 border-[var(--border)] pl-3 text-[var(--text-tertiary)]">
                    &ldquo;{q.moderationEvents[0].note}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 8. Stat Cards strip — key contributor stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {statItems.map((s) => (
          <StatCard
            key={s.label}
            value={s.value}
            label={s.label}
            icon={statIcon(s.label)}
            size="sm"
          />
        ))}
      </div>

      {/* 9. Quick action buttons */}
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/contributor/submit-question">
          <Button>
            <PenSquare className="h-4 w-4" />
            Submit Question
          </Button>
        </Link>
        <Link href="/dashboard/contributor/questions">
          <Button variant="outline">View My Questions</Button>
        </Link>
        <Link href="/dashboard/contributor/my-subjects">
          <Button variant="outline">
            <Eye className="h-4 w-4" />
            My Subjects
          </Button>
        </Link>
      </div>
    </div>
  );
}
