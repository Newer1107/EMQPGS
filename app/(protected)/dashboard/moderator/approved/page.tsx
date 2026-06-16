import { QuestionStatus } from "@prisma/client";
import Link from "next/link";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ModeratorService } from "@/modules/moderation/service";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionStatusLabels } from "@/lib/constants";

export default async function ModeratorApprovedPage() {
  const actor = await getCurrentUserFromCookies();
  const service = new ModeratorService();
  const allQuestions = await service.listQuestions(actor);
  const questions = allQuestions.filter((q) => q.status === QuestionStatus.APPROVED);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Approved Questions</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Questions that have been approved.</p>
      </div>
      <DataTableCard title={`Approved (${questions.length})`}>
        <Table>
          <THead><TR><TH>Subject</TH><TH>Module</TH><TH>Marks</TH><TH>Status</TH><TH>Contributor</TH><TH>Actions</TH></TR></THead>
          <TBody>
            {questions.map((question) => (
              <TR key={question.id}>
                <TD className="font-medium">{question.subjectVersion.subject.subjectCode}</TD>
                <TD>{question.moduleNumber}</TD>
                <TD>{question.marks}</TD>
                <TD><Badge>{questionStatusLabels[question.status] ?? question.status}</Badge></TD>
                <TD>{question.creator.name}</TD>
                <TD>
                  <Link href={`/dashboard/moderator/questions/${question.id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
