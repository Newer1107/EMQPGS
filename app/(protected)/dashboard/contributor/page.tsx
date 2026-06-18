import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { getContributorAssignedBanks } from "@/lib/server-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { questionBankPhaseLabels, questionStatusLabels } from "@/lib/constants";

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

  const stats = {
    submitted: myQuestions.filter((q) => q.status !== "DRAFT").length,
    approved: myQuestions.filter((q) => q.status === "APPROVED").length,
    pending: myQuestions.filter((q) => q.status === "PENDING" || q.status === "REVISION_SUBMITTED").length,
    revisionRequested: myQuestions.filter((q) => q.status === "REVISION_REQUESTED").length,
    rejected: myQuestions.filter((q) => q.status === "REJECTED").length,
    draft: myQuestions.filter((q) => q.status === "DRAFT").length,
  };

  const recentFeedback = myQuestions
    .filter((q) => q.moderationEvents.length > 0 && q.moderationEvents[0].note)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contributor Dashboard"
        description="Contribute questions and track your submissions"
      />

      {banks.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              message="No subjects assigned"
              description="You have not been assigned to any question banks. Contact your coordinator to get started."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">My Banks ({banks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {banks.map((bank) => {
              const svId = bank.subject.versions[0]?.id;

              return (
                <div key={bank.id} className="rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{bank.subject.subjectName}</p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {bank.subject.subjectCode} · Sem {bank.examCycle.batchSemester.semesterNumber} · {bank.examCycle.batchSemester.academicYear.code} · {bank.examCycle.examType.replaceAll("_", " ")}
                      </p>
                    </div>
                    <Badge>{questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}</Badge>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Link href={`/dashboard/contributor/my-subjects`}>
                      <Button size="sm" variant="outline">View Details</Button>
                    </Link>
                    <Link href={`/dashboard/contributor/submit-question?subjectVersionId=${svId ?? ''}`}>
                      <Button size="sm">Submit Question</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <StatItem label="Submitted" value={stats.submitted} />
            <StatItem label="Approved" value={stats.approved} />
            <StatItem label="Pending" value={stats.pending} />
            <StatItem label="Revision Requested" value={stats.revisionRequested} />
            <StatItem label="Rejected" value={stats.rejected} />
            <StatItem label="Draft" value={stats.draft} />
          </div>
        </CardContent>
      </Card>

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
                  Module {q.moduleNumber} · {q.marks} marks
                </p>
                {q.moderationEvents[0]?.note && (
                  <p className="mt-2 text-sm italic border-l-2 border-[var(--border)] pl-3">
                    {'\u201C'}{q.moderationEvents[0].note}{'\u201D'}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href="/dashboard/contributor/questions">
          <Button variant="outline">View My Questions</Button>
        </Link>
        <Link href="/dashboard/contributor/submit-question">
          <Button>Create New Question</Button>
        </Link>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{label}</p>
    </div>
  );
}


