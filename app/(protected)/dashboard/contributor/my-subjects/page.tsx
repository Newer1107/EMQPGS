import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import Link from "next/link";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { getContributorAssignedBanks } from "@/lib/server-data";
import { questionBankPhaseLabels } from "@/lib/constants";

export default async function ContributorMySubjectsPage() {
  const actor = await getCurrentUserFromCookies();
  const banks = await getContributorAssignedBanks(actor.id);

  if (banks.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Subjects" description="Subjects and question banks assigned to you." />
        <Card>
          <CardContent className="py-12">
            <EmptyState
              message="No subjects assigned yet"
              description="Your coordinator has not assigned you to any question banks. Contact your coordinator to get started."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Subjects"
        description={`${banks.length} question bank(s) assigned to you.`}
      />
      <div className="space-y-4">
        {banks.map((bank) => {
          const svId = bank.subject.versions[0]?.id;
          const mySlotCount = bank.slots.filter(
            (s) => s.assignedQuestion?.ownerId === actor.id
          ).length;
          const totalSlots = bank.slots.length;
          const filledSlots = bank.slots.filter((s) => s.assignedQuestion !== null).length;
          const fillPercent = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
          return (
            <Card key={bank.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{bank.subject.subjectName}</CardTitle>
                    <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                      {bank.subject.subjectCode} · Sem {bank.examCycle.batchSemester.semesterNumber} · {bank.examCycle.batchSemester.academicYear.code} · {bank.examCycle.examType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}</Badge>
                    <span className="text-xs text-[var(--text-tertiary)]">{mySlotCount} of mine</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                    <span>{filledSlots} of {totalSlots} slots filled</span>
                    <span>{fillPercent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--border-soft)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                </div>
                <Link href={`/dashboard/contributor/submit-question?subjectVersionId=${svId ?? ''}`}>
                  <Button size="sm">Submit Question for This Subject</Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
