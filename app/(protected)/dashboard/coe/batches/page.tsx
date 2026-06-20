import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BatchForm } from "@/components/forms/batch-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";

export const metadata: Metadata = { title: "Batches — EMQPGS" };

export default async function BatchesPage() {
  const [batches, departments, schemes] = await Promise.all([
    prisma.batch.findMany({
      orderBy: [{ admissionYear: "desc" }, { name: "asc" }],
      include: { department: true, curriculumScheme: true, _count: { select: { batchSemesters: true } } },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.curriculumScheme.findMany({ orderBy: { year: "desc" }, select: { id: true, name: true, year: true, durationSemesters: true } }),
  ]);

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
              <TR><TH>Name</TH><TH>Department</TH><TH>Scheme</TH><TH>Current Sem</TH><TH>Period</TH><TH>Status</TH><TH>Semesters</TH></TR>
            </THead>
            <TBody>
              {batches.length === 0 && (
                <TR><TD colSpan={7}><EmptyState message="No batches have been created yet" description="Create your first student batch to begin scheduling semesters and assigning curriculum." /></TD></TR>
              )}
              {batches.map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium"><Link href={`/dashboard/coe/batches/${b.id}`} className="underline">{b.name}</Link></TD>
                  <TD>{b.department?.name ?? '-'}</TD>
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
        <BatchForm departments={departments} schemes={schemes} />
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
        <span className="text-sm text-[var(--text-tertiary)]">Done setting up batches?</span>
        <span className="text-sm text-[var(--text-tertiary)]">The next phase is creating exam cycles and question banks.</span>
      </div>
    </div>
  );
}

