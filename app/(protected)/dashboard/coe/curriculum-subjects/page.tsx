import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata: Metadata = { title: "Curriculum Subjects — EMQPGS" };

const groupLabels: Record<string, string> = { ALL: "All Groups", GROUP_1: "Group 1", GROUP_2: "Group 2" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

export default async function CurriculumSubjectsPage() {
  const subjects = await prisma.curriculumSubject.findMany({
    orderBy: [{ semesterNumber: "asc" }, { subject: { subjectName: "asc" } }],
    include: { curriculumScheme: { select: { id: true, name: true, year: true } }, subject: { select: { subjectCode: true, subjectName: true } }, academicUnit: { select: { name: true, code: true } } },
  });
  const schemes = await prisma.curriculumScheme.findMany({ orderBy: { year: "desc" } });
  const allSubjects = await prisma.subject.findMany({ orderBy: { subjectName: "asc" } });
  const units = await prisma.academicUnit.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Curriculum Subjects</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Place existing subjects into a semester, taught by a specific academic unit and teaching group.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Curriculum Subjects">
          <Table>
            <THead>
              <TR><TH>Scheme</TH><TH>Subject</TH><TH>Semester</TH><TH>Academic Unit</TH><TH>Group</TH></TR>
            </THead>
            <TBody>
              {subjects.length === 0 && <TR><TD colSpan={5} className="text-center text-muted-foreground py-8">No curriculum subjects found.</TD></TR>}
              {subjects.map((s) => (
                <TR key={s.id}>
                  <TD>{s.curriculumScheme?.name} ({s.curriculumScheme?.year})</TD>
                  <TD className="font-medium">{s.subject?.subjectName} <span className="text-xs text-muted-foreground">({s.subject?.subjectCode})</span></TD>
                  <TD><Badge className="bg-gray-50 text-gray-600 border-gray-300">Semester {s.semesterNumber}</Badge></TD>
                  <TD>{s.academicUnit?.name ?? '-'}</TD>
                  <TD><Badge className="bg-gray-50 text-gray-600 border-gray-300">{groupLabels[s.groupAssignment] ?? s.groupAssignment}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Add Curriculum Subject"
          endpoint="/api/curriculum-subjects"
          fields={[
            { name: "curriculumSchemeId", label: "Curriculum Scheme ID", type: "text" },
            { name: "subjectId", label: "Subject ID", type: "text" },
            { name: "semesterNumber", label: "Semester (1-8)", type: "number" },
            { name: "academicUnitId", label: "Academic Unit ID", type: "text" },
          ]}
        />
      </div>
    </div>
  );
}

