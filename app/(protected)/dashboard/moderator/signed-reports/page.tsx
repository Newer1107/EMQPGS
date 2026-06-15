import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function ModeratorSignedReportsPage() {
  const actor = await getCurrentUserFromCookies();

  const assignments = await prisma.moderatorBankAssignment.findMany({
    where: { moderatorId: actor.id },
    include: {
      questionBank: {
        include: { subject: true, examCycle: { include: { academicYear: true, semester: true } } },
      },
    },
  });

  const reportableBanks = assignments
    .filter((a) => a.questionBank.status === "REPORT_GENERATED" || a.questionBank.status === "AWAITING_HOD_SIGN")
    .map((a) => a.questionBank);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Signed Reports</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Upload signed HOD reports for question banks awaiting your signature.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Banks Awaiting Signed Report</CardTitle></CardHeader>
        <CardContent>
          {reportableBanks.length > 0 ? (
            <Table>
              <THead><TR><TH>Subject</TH><TH>Exam Cycle</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
              <TBody>
                {reportableBanks.map((bank) => (
                  <TR key={bank.id}>
                    <TD className="font-medium">{bank.subject.subjectCode} - {bank.subject.subjectName}</TD>
                    <TD>{bank.examCycle.examType} · {bank.examCycle.semester.name} ({bank.examCycle.academicYear.code})</TD>
                    <TD><Badge>{bank.status}</Badge></TD>
                    <TD>
                      <Link href={`/dashboard/moderator/question-banks/${bank.id}/signed-report`}>
                        <Button variant="outline" size="sm">Upload Report</Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">No banks currently require a signed report.</p>
          )}
        </CardContent>
      </Card>

      {assignments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>All Your Assigned Banks</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Subject</TH><TH>Exam Cycle</TH><TH>Status</TH></TR></THead>
              <TBody>
                {assignments.map((a) => (
                  <TR key={a.questionBank.id}>
                    <TD className="font-medium">{a.questionBank.subject.subjectName}</TD>
                    <TD>{a.questionBank.examCycle.examType} · {a.questionBank.examCycle.semester.name}</TD>
                    <TD><Badge>{a.questionBank.status}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
