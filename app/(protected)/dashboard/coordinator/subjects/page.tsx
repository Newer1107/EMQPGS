import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { prisma } from "@/lib/db";

export default async function SubjectsManagementPage() {
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();
  const subjectService = new SubjectManagementService();
  const [subjects, departmentIds] = await Promise.all([
    subjectService.listSubjects(actor),
    deptUtils.getAssignedDepartmentIds(actor),
  ]);
  const semesters = await prisma.semester.findMany({
    where: { academicYear: { status: "ACTIVE" } },
    include: { academicYear: true },
    orderBy: [{ academicYearId: "asc" }, { number: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Subjects</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create and view subjects limited to your assigned departments.</p>
      </div>
      <DataTableCard title="Branch Subjects">
        <Table>
          <THead><TR><TH>Department</TH><TH>Code</TH><TH>Name</TH><TH>Semester</TH><TH>Credits</TH><TH>Status</TH><TH>Linked Exam Cycles</TH></TR></THead>
          <TBody>
            {(subjects as unknown as Array<{ id: string; subjectCode: string; subjectName: string; credits: number; status: string; department: { name: string }; semester: { name: string; academicYear: { code: string } }; examCycleLinks: Array<{ examCycle: { semester: { name: string }; academicYear: { code: string } } }> }>).map((subject) => (
              <TR key={subject.id}>
                <TD>{subject.department.name}</TD>
                <TD className="font-medium">{subject.subjectCode}</TD>
                <TD>{subject.subjectName}</TD>
                <TD>{subject.semester.name} · {subject.semester.academicYear.code}</TD>
                <TD>{subject.credits}</TD>
                <TD>{subject.status}</TD>
                <TD>{subject.examCycleLinks.map((link) => `${link.examCycle.semester.name} · ${link.examCycle.academicYear.code}`).join(", ") || "Not linked"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
