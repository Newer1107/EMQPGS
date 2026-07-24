import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MySubjectsPage() {
  const user = await getCurrentUserFromCookies();

  const assignments = await prisma.responsibilityAssignment.findMany({
    where: { userId: user.id, responsibility: "CONTRIBUTOR", scopeType: "QUESTION_BANK", deletedAt: null },
    select: { scopeId: true },
  });

  const bankIds = assignments.map((a) => a.scopeId).filter((id): id is string => id !== null);
  const assignedBanks = bankIds.length > 0 ? await prisma.questionBank.findMany({
    where: { id: { in: bankIds } },
    include: {
      subject: true,
      batchSemester: { include: { academicYear: true } },
      pattern: true,
      _count: { select: { slots: true } },
    },
  }) : [];

  const groups = new Map<string, typeof assignedBanks>();
  for (const bank of assignedBanks) {
    const key = bank.subject.subjectName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bank);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Subjects"
        description={`${assignedBanks.length} question bank${assignedBanks.length !== 1 ? "s" : ""} across ${groups.size} subject${groups.size !== 1 ? "s" : ""}.`}
      />
      {assignedBanks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">You have not been assigned to any question banks yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Array.from(groups.entries()).map(([subjectName, banks]) => (
            <div key={subjectName}>
              <h2 className="mb-3 text-lg font-semibold">{subjectName}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {banks.map((bank) => {
                  const totalSlots = bank.pattern?.totalSlots ?? 0;
                  const filledSlots = bank._count.slots;
                  const fillPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
                  return (
                    <Link key={bank.id} href={`/dashboard/contributor/bank?bank=${bank.id}`} className="block">
                      <Card className="h-full transition-shadow hover:shadow-md">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{bank.subject.subjectCode}</CardTitle>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            Sem {bank.batchSemester.semesterNumber} · {bank.batchSemester.academicYear.code}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--text-tertiary)]">Phase</span>
                            <Badge>{bank.phase}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--text-tertiary)]">Fill Rate</span>
                            <span className="font-mono">{fillPct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                            <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${fillPct}%` }} />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
