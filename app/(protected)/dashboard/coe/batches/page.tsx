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
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Batches">
          <Table>
            <THead>
              <TR><TH>Name</TH><TH>Programme</TH><TH>Scheme</TH><TH>Current Sem</TH><TH>Period</TH><TH>Status</TH><TH>Semesters</TH></TR>
            </THead>
            <TBody>
              {batches.length === 0 && (
                <TR><TD colSpan={7}><EmptyState message="No batches found" description="Create a batch to get started." /></TD></TR>
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
          endpoint="/api/batches"
          transform={(p) => ({ ...p, admissionYear: Number(p.admissionYear), graduationYear: Number(p.graduationYear), hasTeachingGroups: false })}
          fields={[
            { name: "name", label: "Name", type: "text" },
            { name: "code", label: "Code", type: "text" },
            { name: "programmeId", label: "Programme", type: "select", options: programmes.map((p) => ({ value: p.id, label: p.name })) },
            { name: "curriculumSchemeId", label: "Curriculum Scheme", type: "select", options: schemes.map((s) => ({ value: s.id, label: `${s.name} (${s.year})` })) },
            { name: "admissionYear", label: "Admission Year", type: "number" },
            { name: "graduationYear", label: "Graduation Year", type: "number" },
          ]}
        />
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
        <span className="text-sm text-[var(--muted-foreground)]">Done setting up batches?</span>
        <span className="text-sm text-[var(--muted-foreground)]">The next phase is creating exam cycles and question banks.</span>
      </div>
    </div>
  );
}

