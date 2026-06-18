import { Role } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function ContributorMySubjectsPage() {
  const workspace = await getQuestionContributionWorkspace(Role.CONTRIBUTOR);
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Subjects"
        description="Review the current subject and exam cycle available for contribution."
      />
      <DataTableCard title="Assigned Subject">
        <Table>
          <THead><TR><TH>Subject Code</TH><TH>Subject Name</TH><TH>Academic Year</TH><TH>Semester</TH></TR></THead>
          <TBody>
            <TR>
              <TD>{workspace.questionBank.subject?.subjectCode}</TD>
              <TD>{workspace.questionBank.subject?.subjectName}</TD>
              <TD>{workspace.questionBank.examCycle?.batchSemester.academicYear.code}</TD>
              <TD>{workspace.questionBank.examCycle?.batchSemester.semesterNumber}</TD>
            </TR>
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

