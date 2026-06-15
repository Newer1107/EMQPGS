import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionStatusLabels } from "@/lib/constants";

export default async function ContributorQuestionsPage() {
  const actor = await getCurrentUserFromCookies();
  const questions = await prisma.questionLibraryItem.findMany({
    where: { createdById: actor.id },
    orderBy: { createdAt: "desc" },
    include: {
      subjectVersion: {
        include: { subject: true, effectiveFromAcademicYear: true },
      },
      bankLinks: {
        include: { questionBank: { select: { id: true, examCycle: { select: { examType: true } } } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Questions</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Questions you have created in the question library.</p>
      </div>
      <DataTableCard title="Question Library">
        <Table>
          <THead><TR><TH>Subject</TH><TH>Module</TH><TH>Marks</TH><TH>Status</TH><TH>Linked Banks</TH></TR></THead>
          <TBody>
            {questions.map((question) => (
              <TR key={question.id}>
                <TD className="font-medium">{question.subjectVersion.subject.subjectCode}</TD>
                <TD>{question.moduleNumber}</TD>
                <TD>{question.marks}</TD>
                <TD><Badge>{questionStatusLabels[question.status] ?? question.status}</Badge></TD>
                <TD>{question.bankLinks.map((link) => link.questionBank.examCycle.examType).join(", ") || "None"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
