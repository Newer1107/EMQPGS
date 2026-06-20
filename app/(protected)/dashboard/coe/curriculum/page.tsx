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

export default async function CurriculumPage({ searchParams }: { searchParams: Promise<{ departmentId?: string; schemeId?: string; semester?: string }> }) {
  const { departmentId, schemeId, semester } = await searchParams;

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const activeDepartmentId = departmentId || null;

  const schemes = await prisma.curriculumScheme.findMany({
    where: activeDepartmentId ? { departmentId: activeDepartmentId } : undefined,
    orderBy: [{ year: "desc" }, { name: "asc" }],
    include: { department: true, _count: { select: { curriculumSubjects: true } } },
  });

  const activeScheme = schemeId ? schemes.find((s) => s.id === schemeId) : null;
  const selectedSemester = semester ? Number(semester) : null;

  const availableSubjects = activeDepartmentId
    ? await prisma.subject.findMany({ where: { departmentId: activeDepartmentId, status: "ACTIVE" }, orderBy: { subjectName: "asc" }, select: { id: true, subjectCode: true, subjectName: true } })
    : [];

  const subjects = activeScheme
    ? await prisma.curriculumSubject.findMany({
        where: { curriculumSchemeId: activeScheme.id, ...(selectedSemester ? { semesterNumber: selectedSemester } : {}) },
        orderBy: [{ semesterNumber: "asc" }, { subject: { subjectName: "asc" } }],
        include: { subject: { select: { subjectCode: true, subjectName: true, credits: true } }, department: { select: { name: true, code: true } } },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum"
        description="Arrange subjects into semesters for each curriculum scheme. Select a department and scheme, then add subjects to each semester."
      />

      <div className="flex flex-wrap gap-2">
        {departments.map((d) => (
          <Link
            key={d.id}
            href={`/dashboard/coe/curriculum${activeDepartmentId === d.id ? '' : `?departmentId=${d.id}`}`}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 ${activeDepartmentId === d.id ? 'border-black bg-gray-50 font-medium' : 'text-[var(--text-tertiary)]'}`}
          >
            {d.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {schemes.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/coe/curriculum${activeDepartmentId ? `?departmentId=${activeDepartmentId}&` : '?'}schemeId=${s.id}`}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100 ${activeScheme?.id === s.id ? 'border-black bg-gray-50' : ''}`}
          >
            {s.name} ({s.year}) — {s.department?.name ?? '-'} ({s._count.curriculumSubjects} subjects)
          </Link>
        ))}
      </div>

      {activeScheme && (
        <div className="flex flex-wrap gap-2 border-b pb-2">
          <Link
            href={`/dashboard/coe/curriculum${activeDepartmentId ? `?departmentId=${activeDepartmentId}&` : '?'}schemeId=${activeScheme.id}`}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${!selectedSemester ? 'border-b-2 border-black' : 'text-[var(--text-tertiary)]'}`}
          >
            All Semesters
          </Link>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <Link
              key={sem}
              href={`/dashboard/coe/curriculum${activeDepartmentId ? `?departmentId=${activeDepartmentId}&` : '?'}schemeId=${activeScheme.id}&semester=${sem}`}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${selectedSemester === sem ? 'border-b-2 border-black' : 'text-[var(--text-tertiary)]'}`}
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
                <TR><TH>Semester</TH><TH>Subject</TH><TH>Credits</TH><TH>Teaching Group</TH></TR>
              </THead>
              <TBody>
                {subjects.length === 0 && <TR><TD colSpan={4}><EmptyState message="No subjects have been placed yet" description="Select a curriculum scheme and semester above, then add subjects to begin building the curriculum." /></TD></TR>}
                {subjects.map((s) => (
                  <TR key={s.id}>
                    <TD><Badge className="bg-gray-100 text-gray-700 border-gray-200">Semester {s.semesterNumber}</Badge></TD>
                    <TD className="font-medium">{s.subject?.subjectName} <span className="text-xs text-[var(--text-tertiary)]">({s.subject?.subjectCode})</span></TD>
                    <TD>{s.subject?.credits ?? '-'}</TD>
                    <TD><Badge className="bg-gray-100 text-gray-700 border-gray-200">{groupLabels[s.groupAssignment] ?? s.groupAssignment}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Select a curriculum scheme above to see its subjects.</div>
          )}
        </DataTableCard>

        <div className="space-y-6">
          {activeScheme && (
            <SimpleForm
              title={selectedSemester ? `Add Subject to Semester ${selectedSemester}` : "Add Subject"}
              submitLabel="Add Subject"
              endpoint="/api/curriculum-subjects"
              extraPayload={{ curriculumSchemeId: activeScheme.id, groupAssignment: "ALL", ...(activeDepartmentId ? { departmentId: activeDepartmentId } : {}) }}
              fields={[
                { name: "subjectId", label: "Subject", type: "select", options: availableSubjects.map((s) => ({ value: s.id, label: `${s.subjectName} (${s.subjectCode})` })) },
                { name: "semesterNumber", label: "Semester (1-8)", type: "number" },
              ]}
            />
          )}
          {!activeScheme && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Add Subject</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--text-tertiary)]">Select a curriculum scheme first to add subjects.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
        <span className="text-sm text-[var(--text-tertiary)]">Next step:</span>
        <Link href="/dashboard/coe/batches" className="text-sm font-medium underline">Go to Batches →</Link>
      </div>
    </div>
  );
}

