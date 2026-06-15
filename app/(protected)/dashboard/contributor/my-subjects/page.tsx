import { Role } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function ContributorMySubjectsPage() {
  const workspace = await getQuestionContributionWorkspace(Role.CONTRIBUTOR);
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Subjects</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Review the current subject and exam cycle available for contribution.</p>
      </div>
      <DataTableCard title="Assigned Subject">
        <Table>
          <THead><TR><TH>Subject Code</TH><TH>Subject Name</TH><TH>Academic Year</TH><TH>Semester</TH></TR></THead>
          <TBody>
            <TR>
              <TD>{(workspace.questionBank as any).subject?.subjectCode}</TD>
              <TD>{(workspace.questionBank as any).subject?.subjectName}</TD>
              <TD>{(workspace.questionBank as any).examCycle?.academicYear?.code}</TD>
              <TD>{(workspace.questionBank as any).examCycle?.semester?.name}</TD>
            </TR>
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
