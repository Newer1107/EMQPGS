import { Role } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function ContributorMySubjectsPage() {
  const workspace = await getQuestionContributionWorkspace(Role.CONTRIBUTOR);
  if (!workspace) return null;

  const assignedModules = workspace.questionBank.assignments
    .filter((assignment) => assignment.teacherId === workspace.actor.id && assignment.assignmentRole === "CONTRIBUTOR")
    .length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Subjects</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Review the current subject and exam cycle assignment available for contribution.</p>
      </div>
      <DataTableCard title="Assigned Subject">
        <Table>
          <THead><TR><TH>Subject Code</TH><TH>Subject Name</TH><TH>Academic Year</TH><TH>Semester</TH><TH>Assigned Roles</TH></TR></THead>
          <TBody>
            <TR>
              <TD>{workspace.questionBank.subject.subjectCode}</TD>
              <TD>{workspace.questionBank.subject.subjectName}</TD>
              <TD>{workspace.questionBank.examCycle.academicYear}</TD>
              <TD>{workspace.questionBank.examCycle.semester}</TD>
              <TD>{assignedModules > 0 ? `${assignedModules} active assignment(s)` : "No active assignment"}</TD>
            </TR>
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
