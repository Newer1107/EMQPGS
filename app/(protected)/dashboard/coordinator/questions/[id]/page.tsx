import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionStatusLabels, difficultyLabels } from "@/lib/constants";
import { OwnershipTransferForm } from "@/components/forms/ownership-transfer-form";

export default async function CoordinatorQuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();

  const question = await prisma.questionLibraryItem.findUnique({
    where: { id },
    include: {
      subjectVersion: { include: { subject: { include: { department: true } }, effectiveFromAcademicYear: true } },
      creator: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, name: true, email: true } },
      slotAssignments: { include: { questionBank: { include: { examCycle: { include: { batchSemester: { include: { academicYear: true } } } } } } } },
    },
  });
  if (!question) notFound();
  await deptUtils.assertDepartmentAccess(actor, question.subjectVersion.subject.departmentId);

  const [ownershipHistory, revisionHistory, usageHistory] = await Promise.all([
    prisma.questionOwnershipHistory.findMany({
      where: { questionId: id },
      orderBy: { transferredAt: "desc" },
      include: { fromUser: { select: { name: true } }, toUser: { select: { name: true } }, transferredBy: { select: { name: true } } },
    }),
    prisma.questionRevision.findMany({
      where: { questionId: id },
      orderBy: { createdAt: "desc" },
      include: { changedBy: { select: { name: true } } },
    }),
    prisma.questionUsageHistory.findMany({
      where: { questionId: id },
      orderBy: { usedAt: "desc" },
      take: 20,
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { role: { in: ["CONTRIBUTOR", "COORDINATOR"] } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Question Detail</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{question.subjectVersion.subject.subjectCode} · Module {question.moduleNumber} · {question.marks} marks</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Question</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{question.questionText}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-[var(--muted-foreground)]">Subject</dt><dd className="font-medium">{question.subjectVersion.subject.subjectName}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Department</dt><dd>{question.subjectVersion.subject.department.name}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Module</dt><dd>{question.moduleNumber}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Marks</dt><dd>{question.marks}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Course Outcome</dt><dd>{question.coMapping}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">RBT Level</dt><dd>{question.rbtLevel}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Difficulty</dt><dd>{question.difficultyLevel ? difficultyLabels[question.difficultyLevel as keyof typeof difficultyLabels] : "Not set"}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Status</dt><dd><Badge>{questionStatusLabels[question.status] ?? question.status}</Badge></dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Creator</dt><dd>{question.creator.name}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Owner</dt><dd>{question.owner.name}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Ownership History ({ownershipHistory.length})</h3>
                {ownershipHistory.length > 0 ? (
                  <Table>
                    <THead><TR><TH>From</TH><TH>To</TH><TH>Transferred By</TH><TH>Date</TH></TR></THead>
                    <TBody>
                      {ownershipHistory.map((h) => (
                        <TR key={h.id}>
                          <TD>{h.fromUser.name}</TD>
                          <TD>{h.toUser.name}</TD>
                          <TD>{h.transferredBy.name}</TD>
                          <TD className="text-xs">{new Date(h.transferredAt).toLocaleDateString()}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)]">No ownership changes recorded</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Revision History ({revisionHistory.length})</h3>
                {revisionHistory.length > 0 ? (
                  <Table>
                    <THead><TR><TH>Revision</TH><TH>Changed By</TH><TH>Date</TH></TR></THead>
                    <TBody>
                      {revisionHistory.map((h) => (
                        <TR key={h.id}>
                          <TD>v{h.revisionNumber}</TD>
                          <TD>{h.changedBy.name}</TD>
                          <TD className="text-xs">{new Date(h.createdAt).toLocaleDateString()}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)]">No revisions recorded</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Usage History ({usageHistory.length})</h3>
                {usageHistory.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {usageHistory.map((u) => (
                      <li key={u.id}>
                        Used on {new Date(u.usedAt).toLocaleDateString()}
                        · {u.sourceType}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)]">Not yet used in any paper</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <OwnershipTransferForm questionId={id} users={users} currentOwnerId={question.ownerId} />
        </div>
      </div>
    </div>
  );
}
