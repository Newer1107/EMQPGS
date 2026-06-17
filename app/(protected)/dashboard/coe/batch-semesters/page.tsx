import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata: Metadata = { title: "Batch Semesters — EMQPGS" };

const statusStyles: Record<string, string> = { UPCOMING: "bg-gray-100 text-gray-700", ACTIVE: "bg-green-100 text-green-800", COMPLETED: "bg-blue-100 text-blue-800" };

export default async function BatchSemestersPage({ searchParams }: { searchParams: Promise<{ batchId?: string }> }) {
  const { batchId } = await searchParams;
  const batches = await prisma.batch.findMany({ orderBy: { name: "asc" }, include: { programme: true } });

  const semesters = batchId
    ? await prisma.batchSemester.findMany({
        where: { batchId },
        orderBy: { semesterNumber: "asc" },
        include: { academicYear: true, academicUnit: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Batch Semesters</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          A batch semester represents one teaching period for one batch. Select a batch to view its timeline.
        </p>
      </div>

      <div className="flex gap-2">
        {batches.map((b) => (
          <a
            key={b.id}
            href={`/dashboard/coe/batch-semesters?batchId=${b.id}`}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100 ${batchId === b.id ? 'border-black bg-gray-50' : ''}`}
          >
            {b.name}
          </a>
        ))}
      </div>

      {semesters.length > 0 && (
        <DataTableCard title={`Semesters — ${batches.find((b) => b.id === batchId)?.name ?? ''}`}>
          <Table>
            <THead>
              <TR><TH>Semester</TH><TH>Academic Year</TH><TH>Academic Unit</TH><TH>Start Date</TH><TH>End Date</TH><TH>Status</TH></TR>
            </THead>
            <TBody>
              {semesters.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium">Semester {s.semesterNumber}</TD>
                  <TD>{s.academicYear?.code ?? '-'}</TD>
                  <TD>{s.academicUnit?.name ?? '-'}</TD>
                  <TD>{s.startDate ? new Date(s.startDate).toLocaleDateString() : '-'}</TD>
                  <TD>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '-'}</TD>
                  <TD><Badge className={statusStyles[s.status] ?? ''}>{s.status}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
      )}

      {batchId && semesters.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-12 text-center text-sm text-muted-foreground">No semesters found for this batch.</div>
      )}

      {!batchId && (
        <div className="rounded-lg border-2 border-dashed p-12 text-center text-sm text-muted-foreground">Select a batch above to view its semesters.</div>
      )}
    </div>
  );
}

