import { getCurrentUserFromCookies } from "@/lib/api-context";
import { CoordinatorService } from "@/modules/coordinator/service";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataTableCard } from "@/components/dashboard/data-table-card";

export default async function SubjectsManagementPage() {
  const actor = await getCurrentUserFromCookies();
  const service = new CoordinatorService();
  const subjects = await service.listSubjects(actor);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Subjects</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Read-only subject visibility limited to your assigned departments.</p>
      </div>
      <DataTableCard title="Branch Subjects">
        <Table>
          <THead><TR><TH>Department</TH><TH>Code</TH><TH>Name</TH><TH>Semester</TH><TH>Credits</TH><TH>Status</TH><TH>Linked Exam Cycles</TH></TR></THead>
          <TBody>
            {subjects.map((subject) => (
              <TR key={subject.id}>
                <TD>{subject.department.name}</TD>
                <TD className="font-medium">{subject.subjectCode}</TD>
                <TD>{subject.subjectName}</TD>
                <TD>{subject.semester}</TD>
                <TD>{subject.credits}</TD>
                <TD>{subject.status}</TD>
                <TD>{subject.examCycleLinks.map((link) => `${link.examCycle.academicYear} / Sem ${link.examCycle.semester} / ${link.examCycle.examType}`).join(", ") || "Not linked"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
