import Link from "next/link";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { PageHeader } from "@/components/dashboard/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Button } from "@/components/ui/button";

export default async function SubjectsManagementPage() {
  const actor = await getCurrentUserFromCookies();
  const subjectService = new SubjectManagementService();
  const subjects = await subjectService.listSubjects(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subjects"
        description="Create and view subjects limited to your assigned departments."
        actions={
          <Link href="/dashboard/coordinator/subjects/create">
            <Button>Create Subject</Button>
          </Link>
        }
      />
      <DataTableCard title="Department Subjects">
        <Table>
          <THead><TR><TH>Department</TH><TH>Code</TH><TH>Name</TH><TH>Credits</TH><TH>Status</TH><TH>Linked Exam Cycles</TH><TH>Actions</TH></TR></THead>
          <TBody>
            {(subjects as unknown as Array<{ id: string; subjectCode: string; subjectName: string; credits: number; status: string; department: { name: string; id: string }; examCycleLinks: Array<{ examCycle: { batchSemester: { semesterNumber: number; academicYear: { code: string } } } }> }>).map((subject) => (
              <TR key={subject.id}>
                <TD>{subject.department?.name ?? ''}</TD>
                <TD className="font-medium">{subject.subjectCode}</TD>
                <TD>
                  <Link href={`/dashboard/coordinator/subjects/${subject.id}`} className="underline underline-offset-2 hover:text-[var(--muted-foreground)]">
                    {subject.subjectName}
                  </Link>
                </TD>
                <TD>{subject.credits} cr</TD>
                <TD>{subject.status}</TD>
                <TD>{subject.examCycleLinks.map((link) => `Sem ${link.examCycle.batchSemester.semesterNumber} · ${link.examCycle.batchSemester.academicYear.code}`).join(", ") || "Not linked"}</TD>
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

