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
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/dashboard/coe/batches" className="hover:text-[var(--text-primary)] transition-colors">Batches</Link>
        <span>/</span>
        <Link href={`/dashboard/coe/batches/${id}`} className="hover:text-[var(--text-primary)] transition-colors">{batch.name}</Link>
        <span>/</span>
        <span className="font-medium text-[var(--text-primary)]">Teaching Groups</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teaching Groups — {batch.name}</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)] max-w-2xl">
          Teaching groups are used when first-year students are split into streams that study different subjects.
          Groups are automatically created when you enable teaching groups during batch creation.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        <Link href={`/dashboard/coe/batches/${id}`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Overview</Link>
        <Link href={`/dashboard/coe/batches/${id}/semesters`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Semesters</Link>
        <Link href={`/dashboard/coe/batches/${id}/teaching-groups`} className="border-b-2 border-black px-4 py-2 text-sm font-medium">Teaching Groups</Link>
        <Link href={`/dashboard/coe/batches/${id}/history`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">History</Link>
        <Badge variant={batch.status === "GRADUATED" ? "info" : "success"} className="ml-auto self-center">
          {batch.status === "GRADUATED" ? "Graduated" : "Active"}
        </Badge>
      </div>

      {batch.hasTeachingGroups ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">No teaching groups yet</p>
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">Teaching groups will appear here once semesters are configured and activated.</p>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.id} className={`rounded-lg border p-5 ${g.isActive ? 'bg-white' : 'bg-gray-50 border-dashed'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-xs text-[var(--text-tertiary)]">Group {g.groupNumber}</p>
                </div>
                <Badge variant={g.isActive ? "success" : "default"}>{g.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              {g.description && <p className="text-sm text-[var(--text-tertiary)]">{g.description}</p>}
              {!g.description && <p className="text-sm text-[var(--text-tertiary)] italic">No description</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">Teaching groups are not enabled</p>
          <p className="mt-2 text-sm text-[var(--text-tertiary)] max-w-md">
            This batch does not use teaching groups. Teaching groups are only needed when first-year students are split into streams.
            If you need teaching groups, you can enable them during batch creation.
          </p>
        </div>
      )}
    </div>
  );
}
