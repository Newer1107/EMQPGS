import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";

export const metadata: Metadata = { title: "Batches — EMQPGS" };

export default async function BatchesPage() {
  const batches = await prisma.batch.findMany({
    orderBy: [{ admissionYear: "desc" }, { name: "asc" }],
    include: { programme: true, curriculumScheme: true, _count: { select: { batchSemesters: true } } },
  });
  const programmes = await prisma.programme.findMany({ orderBy: { name: "asc" } });
  const schemes = await prisma.curriculumScheme.findMany({ orderBy: { year: "desc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches"
        description="A batch is one intake of students. For example, BE Computer Engineering (2025–2029). Each batch follows a curriculum scheme and progresses through semesters."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total Batches</p>
          <p className="mt-1 text-2xl font-bold">{batches.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{batches.filter((b) => b.status === "ACTIVE").length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Graduated</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{batches.filter((b) => b.status === "GRADUATED").length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total Semesters</p>
          <p className="mt-1 text-2xl font-bold">{batches.reduce((sum, b) => sum + b._count.batchSemesters, 0)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Batches">
          <Table>
            <THead>
              <TR><TH>Name</TH><TH>Programme</TH><TH>Scheme</TH><TH>Current Sem</TH><TH>Period</TH><TH>Status</TH><TH>Semesters</TH></TR>
            </THead>
            <TBody>
              {batches.length === 0 && (
                <TR><TD colSpan={7}><EmptyState message="No batches have been created yet" description="Create your first student batch to begin scheduling semesters and assigning curriculum." /></TD></TR>
              )}
              {batches.map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium"><Link href={`/dashboard/coe/batches/${b.id}`} className="underline">{b.name}</Link></TD>
                  <TD>{b.programme?.name ?? '-'}</TD>
                  <TD>{b.curriculumScheme?.name} ({b.curriculumScheme?.year})</TD>
                  <TD>{b.currentSemesterNumber ? <Badge>Semester {b.currentSemesterNumber}</Badge> : '-'}</TD>
                  <TD>{b.admissionYear}–{b.graduationYear}</TD>
                  <TD><Badge variant={b.status === "GRADUATED" ? "info" : "success"}>{b.status === "GRADUATED" ? "Graduated" : "Active"}</Badge></TD>
                  <TD><Link href={`/dashboard/coe/batches/${b.id}/semesters`} className="text-sm underline">{b._count.batchSemesters} semesters</Link></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Create Batch"
          submitLabel="Create Batch"
          endpoint="/api/batches"
          transform={(p) => ({ ...p, admissionYear: Number(p.admissionYear), graduationYear: Number(p.graduationYear), hasTeachingGroups: false })}
          fields={[
            { name: "name", label: "Batch Name", type: "text", placeholder: "e.g. BE CO 2025" },
            { name: "code", label: "Batch Code", type: "text", placeholder: "e.g. BECO-2025" },
            { name: "programmeId", label: "Programme", type: "select", options: programmes.map((p) => ({ value: p.id, label: p.name })) },
            { name: "curriculumSchemeId", label: "Curriculum Scheme", type: "select", options: schemes.map((s) => ({ value: s.id, label: `${s.name} (${s.year})` })) },
            { name: "admissionYear", label: "Admission Year", type: "number", placeholder: "e.g. 2025" },
            { name: "graduationYear", label: "Expected Graduation Year", type: "number", placeholder: "e.g. 2029" },
          ]}
        />
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
        <span className="text-sm text-[var(--text-tertiary)]">Done setting up batches?</span>
        <span className="text-sm text-[var(--text-tertiary)]">The next phase is creating exam cycles and question banks.</span>
      </div>
    </div>
  );
}

