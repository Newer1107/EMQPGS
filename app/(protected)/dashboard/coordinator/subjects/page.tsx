import Link from "next/link";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Button } from "@/components/ui/button";

export default async function SubjectsManagementPage() {
  const actor = await getCurrentUserFromCookies();
  const subjectService = new SubjectManagementService();
  const subjects = await subjectService.listSubjects(actor);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Subjects</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create and view subjects limited to your assigned departments.</p>
        </div>
        <Link href="/dashboard/coordinator/subjects/create">
          <Button>Create Subject</Button>
        </Link>
      </div>
      <DataTableCard title="Department Subjects">
        <Table>
          <THead><TR><TH>Department</TH><TH>Code</TH><TH>Name</TH><TH>Semester</TH><TH>Credits</TH><TH>Status</TH><TH>Linked Exam Cycles</TH><TH>Actions</TH></TR></THead>
          <TBody>
            {(subjects as unknown as Array<{ id: string; subjectCode: string; subjectName: string; credits: number; status: string; department: { name: string; id: string }; semester: { name: string; academicYear: { code: string } }; examCycleLinks: Array<{ examCycle: { semester: { name: string }; academicYear: { code: string } } }> }>).map((subject) => (
              <TR key={subject.id}>
                <TD>{subject.department.name}</TD>
                <TD className="font-medium">{subject.subjectCode}</TD>
                <TD>
                  <Link href={`/dashboard/coordinator/subjects/${subject.id}`} className="underline underline-offset-2 hover:text-[var(--muted-foreground)]">
                    {subject.subjectName}
                  </Link>
                </TD>
                <TD>{subject.semester.name} · {subject.semester.academicYear.code}</TD>
                <TD>{subject.credits}</TD>
                <TD>{subject.status}</TD>
                <TD>{subject.examCycleLinks.map((link) => `${link.examCycle.semester.name} · ${link.examCycle.academicYear.code}`).join(", ") || "Not linked"}</TD>
                <TD>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/coordinator/subjects/${subject.id}/edit`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                    <Link href={`/dashboard/coordinator/subjects/${subject.id}/versions`}>
                      <Button variant="ghost" size="sm">Versions</Button>
                    </Link>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
