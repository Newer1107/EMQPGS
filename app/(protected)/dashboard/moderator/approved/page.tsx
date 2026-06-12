import { Role } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function ModeratorApprovedPage() {
  const workspace = await getQuestionContributionWorkspace(Role.MODERATOR);
  if (!workspace) return null;

  const approvedQuestions = workspace.questionBank.questions.filter((question) => question.status === "APPROVED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Approved Questions</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Review all approved questions in your active moderation workspace.</p>
      </div>
      <DataTableCard title="Approved">
        <Table>
          <THead><TR><TH>Question</TH><TH>Contributor</TH><TH>Module</TH><TH>Marks</TH><TH>Status</TH></TR></THead>
          <TBody>
            {approvedQuestions.map((question) => (
              <TR key={question.id}>
                <TD className="max-w-md whitespace-normal">{question.questionText}</TD>
                <TD>{question.contributor.name}</TD>
                <TD>{question.moduleNumber}</TD>
                <TD>{question.marks}</TD>
                <TD><Badge>{question.status}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
