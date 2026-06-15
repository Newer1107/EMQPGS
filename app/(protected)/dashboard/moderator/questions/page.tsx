import Link from "next/link";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ModeratorService } from "@/modules/moderation/service";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionStatusLabels } from "@/lib/constants";

export default async function ModerationQuestionsPage() {
  const actor = await getCurrentUserFromCookies();
  const service = new ModeratorService();
  const questions = await service.listQuestions(actor);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Moderation Queue</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Review and moderate questions from the question library.</p>
      </div>
      <DataTableCard title="Questions Awaiting Review">
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
                    <Button variant="outline" size="sm">Review</Button>
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
