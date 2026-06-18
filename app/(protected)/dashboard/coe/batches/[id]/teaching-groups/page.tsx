import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = { title: "Teaching Groups — EMQPGS" };

export default async function BatchTeachingGroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) notFound();

  const groups = await prisma.teachingGroup.findMany({
    where: { batchId: id },
    orderBy: { groupNumber: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/coe/batches" className="text-sm text-[var(--muted-foreground)] underline">← Batches</Link>
        <h1 className="text-2xl font-semibold">{batch.name}</h1>
        <Badge>{batch.status}</Badge>
      </div>

      <div className="flex gap-1 border-b">
        <Link href={`/dashboard/coe/batches/${id}`} className="px-4 py-2 text-sm text-[var(--muted-foreground)]">Overview</Link>
        <Link href={`/dashboard/coe/batches/${id}/semesters`} className="px-4 py-2 text-sm text-[var(--muted-foreground)]">Semesters</Link>
        <Link href={`/dashboard/coe/batches/${id}/teaching-groups`} className="border-b-2 border-black px-4 py-2 text-sm font-medium">Teaching Groups</Link>
        <Link href={`/dashboard/coe/batches/${id}/history`} className="px-4 py-2 text-sm text-[var(--muted-foreground)]">History</Link>
      </div>

      <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
        Teaching groups are used when first-year students are split into streams that study different subjects.
        Groups are automatically created when you enable teaching groups during batch creation.
      </p>

      {batch.hasTeachingGroups ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className={`rounded-lg border p-5 ${g.isActive ? 'bg-white' : 'bg-gray-50 border-dashed'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">Group {g.groupNumber}</p>
                </div>
                <Badge variant={g.isActive ? "success" : "default"}>{g.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              {g.description && <p className="text-sm text-[var(--muted-foreground)]">{g.description}</p>}
              {!g.description && <p className="text-sm text-[var(--muted-foreground)] italic">No description</p>}
            </div>
          ))}
          {groups.length === 0 && <div className="col-span-2 rounded-lg border-2 border-dashed p-12 text-center text-sm text-[var(--muted-foreground)]">Teaching groups will appear here once semesters are configured.</div>}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center text-sm text-[var(--muted-foreground)]">
          This batch does not use teaching groups. Teaching groups are only needed when first-year students are split into streams.
        </div>
      )}
    </div>
  );
}
