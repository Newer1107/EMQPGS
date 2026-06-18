import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";

export const metadata: Metadata = { title: "Curriculum — EMQPGS" };

const groupLabels: Record<string, string> = { ALL: "All Groups", GROUP_1: "Group 1", GROUP_2: "Group 2" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

export default async function CurriculumPage({ searchParams }: { searchParams: Promise<{ schemeId?: string; semester?: string }> }) {
  const { schemeId, semester } = await searchParams;

  const programmes = await prisma.programme.findMany({ orderBy: { name: "asc" }, include: { homeAcademicUnit: true } });
  const schemes = await prisma.curriculumScheme.findMany({
    orderBy: [{ year: "desc" }, { name: "asc" }],
    include: { programme: true, _count: { select: { curriculumSubjects: true } } },
  });

  const activeScheme = schemeId ? schemes.find((s) => s.id === schemeId) : null;
  const selectedSemester = semester ? Number(semester) : null;

  const subjects = activeScheme
    ? await prisma.curriculumSubject.findMany({
        where: { curriculumSchemeId: activeScheme.id, ...(selectedSemester ? { semesterNumber: selectedSemester } : {}) },
        orderBy: [{ semesterNumber: "asc" }, { subject: { subjectName: "asc" } }],
        include: { subject: { select: { subjectCode: true, subjectName: true, credits: true } }, academicUnit: { select: { name: true, code: true } } },
      })
    : [];

  const semestersInScheme = activeScheme
    ? [...new Set((await prisma.curriculumSubject.findMany({ where: { curriculumSchemeId: activeScheme.id }, select: { semesterNumber: true }, distinct: ["semesterNumber"] })).map((s) => s.semesterNumber))].sort()
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum"
        description="This is where you decide which subjects are taught during each semester. Select a programme and scheme, then add subjects to each semester. Choose which academic unit teaches each subject and which teaching group takes it."
      />

      <div className="flex flex-wrap gap-2">
        {programmes.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/coe/curriculum`}
            className="rounded-lg border px-3 py-1.5 text-sm text-[var(--muted-foreground)]"
          >
            {p.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {schemes.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/coe/curriculum?schemeId=${s.id}`}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100 ${activeScheme?.id === s.id ? 'border-black bg-gray-50' : ''}`}
          >
            {s.name} ({s.year}) — {s.programme?.name ?? '-'} ({s._count.curriculumSubjects} subjects)
          </Link>
        ))}
      </div>

      {activeScheme && (
        <div className="flex flex-wrap gap-2 border-b pb-2">
          <Link
            href={`/dashboard/coe/curriculum?schemeId=${activeScheme.id}`}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${!selectedSemester ? 'border-b-2 border-black' : 'text-[var(--muted-foreground)]'}`}
          >
            All Semesters
          </Link>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <Link
              key={sem}
              href={`/dashboard/coe/curriculum?schemeId=${activeScheme.id}&semester=${sem}`}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${selectedSemester === sem ? 'border-b-2 border-black' : 'text-[var(--muted-foreground)]'}`}
            >
              Sem {sem}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title={activeScheme ? `${activeScheme.name} — ${selectedSemester ? `Semester ${selectedSemester}` : 'All Semesters'}` : 'Subjects'}>
          {activeScheme ? (
            <Table>
              <THead>
                <TR><TH>Semester</TH><TH>Subject</TH><TH>Credits</TH><TH>Academic Unit</TH><TH>Teaching Group</TH></TR>
              </THead>
              <TBody>
                {subjects.length === 0 && <TR><TD colSpan={5}><EmptyState message="No subjects placed yet" description="Add a subject below." /></TD></TR>}
                {subjects.map((s) => (
                  <TR key={s.id}>
                    <TD><Badge className="bg-gray-100 text-gray-700 border-gray-200">Semester {s.semesterNumber}</Badge></TD>
                    <TD className="font-medium">{s.subject?.subjectName} <span className="text-xs text-[var(--muted-foreground)]">({s.subject?.subjectCode})</span></TD>
                    <TD>{s.subject?.credits ?? '-'}</TD>
                    <TD>{s.academicUnit?.name ?? '-'}</TD>
                    <TD><Badge className="bg-gray-100 text-gray-700 border-gray-200">{groupLabels[s.groupAssignment] ?? s.groupAssignment}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">Select a curriculum scheme above to see its subjects.</div>
          )}
        </DataTableCard>

        <div className="space-y-6">
          {activeScheme && (
            <SimpleForm
              title={selectedSemester ? `Add Subject to Semester ${selectedSemester}` : "Add Subject"}
              endpoint="/api/curriculum-subjects"
              transform={(p) => ({ ...p, curriculumSchemeId: activeScheme.id, semesterNumber: Number(p.semesterNumber), groupAssignment: p.groupAssignment || "ALL" })}
              fields={[
                { name: "subjectId", label: "Subject ID", type: "text" },
                { name: "semesterNumber", label: "Semester (1-8)", type: "number" },
                { name: "academicUnitId", label: "Academic Unit ID", type: "text" },
              ]}
            />
          )}
          {!activeScheme && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Add Subject</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--muted-foreground)]">Select a curriculum scheme first to add subjects.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
        <span className="text-sm text-[var(--muted-foreground)]">Next step:</span>
        <Link href="/dashboard/coe/batches" className="text-sm font-medium underline">Go to Batches →</Link>
      </div>
    </div>
  );
}

