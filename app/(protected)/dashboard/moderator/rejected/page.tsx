import { QuestionStatus } from "@prisma/client";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/get-workspace-context";
import { ModeratorService } from "@/modules/moderation/service";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionStatusLabels } from "@/lib/constants";

export default async function ModeratorRejectedPage() {
  const { context: ctx } = await getWorkspaceContext("MODERATOR");
  const service = new ModeratorService();
  const allQuestions = await service.listQuestions(ctx);
  const questions = allQuestions.filter((q) => q.status === QuestionStatus.REJECTED);

  return (
    <div className="space-y-6">
      <PageHeader title="Rejected Questions" description="Questions rejected in your current workspace." />
      <DataTableCard title={`Rejected (${questions.length})`}>
        <Table>
          <THead><TR><TH>Subject</TH><TH>Module</TH><TH>Marks</TH><TH>Status</TH><TH>Contributor</TH><TH>Rejected On</TH><TH>Actions</TH></TR></THead>
          <TBody>
            {questions.map((question) => (
              <TR key={question.id}>
                <TD className="font-medium">{question.subjectVersion.subject.subjectCode}</TD>
                <TD>{question.moduleNumber}</TD>
                <TD>{question.marks}</TD>
                <TD><Badge variant="danger">{questionStatusLabels[question.status] ?? question.status}</Badge></TD>
                <TD>{question.creator.name}</TD>
                <TD>{question.reviewedAt ? new Date(question.reviewedAt).toLocaleDateString() : "—"}</TD>
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
