import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata: Metadata = { title: "Teaching Groups — EMQPGS" };

export default async function TeachingGroupsPage({ searchParams }: { searchParams: Promise<{ batchId?: string }> }) {
  const { batchId } = await searchParams;
  const batches = await prisma.batch.findMany({ where: { hasTeachingGroups: true }, orderBy: { name: "asc" } });

  const groups = batchId
    ? await prisma.teachingGroup.findMany({
        where: { batchId },
        orderBy: { groupNumber: "asc" },
        include: { batch: { select: { name: true, code: true } } },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Teaching Groups</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Teaching groups are used when first-year students are split into streams that study different subjects.
          Groups are automatically created when you enable teaching groups during batch creation.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {batches.map((b) => (
          <a
            key={b.id}
            href={`/dashboard/coe/teaching-groups?batchId=${b.id}`}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100 ${batchId === b.id ? 'border-black bg-gray-50' : ''}`}
          >
            {b.name}
          </a>
        ))}
        {batches.length === 0 && <p className="text-sm text-muted-foreground">No batches with teaching groups found. Create a batch with teaching groups enabled.</p>}
      </div>

      {groups.length > 0 && (
        <DataTableCard title={`Teaching Groups — ${batches.find((b) => b.id === batchId)?.name ?? ''}`}>
          <Table>
            <THead>
              <TR><TH>Group</TH><TH>Name</TH><TH>Description</TH><TH>Status</TH></TR>
            </THead>
            <TBody>
              {groups.map((g) => (
                <TR key={g.id}>
                  <TD className="font-medium">Group {g.groupNumber}</TD>
                  <TD>{g.name}</TD>
                  <TD className="text-sm text-muted-foreground">{g.description ?? '—'}</TD>
                  <TD>{g.isActive ? <Badge>Active</Badge> : <Badge className="bg-gray-50 text-gray-600 border-gray-300">Inactive</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
      )}

      {batchId && groups.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-12 text-center text-sm text-muted-foreground">No teaching groups found for this batch.</div>
      )}

      {!batchId && batches.length > 0 && (
        <div className="rounded-lg border-2 border-dashed p-12 text-center text-sm text-muted-foreground">Select a batch above to view its teaching groups.</div>
      )}
    </div>
  );
}

