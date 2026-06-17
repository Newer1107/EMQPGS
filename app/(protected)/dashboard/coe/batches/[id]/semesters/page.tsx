import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = { title: "Batch Semesters — EMQPGS" };

const statusStyles: Record<string, string> = { UPCOMING: 'bg-gray-100 text-gray-700 border-gray-200', ACTIVE: 'bg-green-100 text-green-800 border-green-200', COMPLETED: 'bg-blue-100 text-blue-800 border-blue-200' };
const statusLabels: Record<string, string> = { UPCOMING: 'Upcoming', ACTIVE: 'Active', COMPLETED: 'Completed' };

export default async function BatchSemestersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({ where: { id }, include: { programme: true } });
  if (!batch) notFound();

  const semesters = await prisma.batchSemester.findMany({
    where: { batchId: id },
    orderBy: { semesterNumber: "asc" },
    include: { academicYear: true, academicUnit: true },
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
        <Link href={`/dashboard/coe/batches/${id}/semesters`} className="border-b-2 border-black px-4 py-2 text-sm font-medium">Semesters</Link>
        <Link href={`/dashboard/coe/batches/${id}/teaching-groups`} className="px-4 py-2 text-sm text-[var(--muted-foreground)]">Teaching Groups</Link>
        <Link href={`/dashboard/coe/batches/${id}/history`} className="px-4 py-2 text-sm text-[var(--muted-foreground)]">History</Link>
      </div>

      <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
        A semester is one teaching period for this batch. Configure start and end dates, activate when teaching begins,
        and mark complete when it ends. The highlighted semester is the current one.
      </p>

      <div className="space-y-3">
        {semesters.map((sem) => {
          const isCurrent = sem.status === "ACTIVE";
          return (
            <div key={sem.id} className={`rounded-lg border p-5 transition-all ${isCurrent ? 'border-green-400 bg-green-50 ring-2 ring-green-200' : 'bg-white'}`}>
              {isCurrent && <div className="mb-2 inline-block rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-semibold text-white">Current</div>}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Semester {sem.semesterNumber}</h3>
                  <div className="mt-1 space-y-0.5 text-sm text-[var(--muted-foreground)]">
                    <p>Academic Year: {sem.academicYear?.code ?? '-'}</p>
                    <p>Academic Unit: {sem.academicUnit?.name ?? '-'}</p>
                    <p>Start: {sem.startDate ? new Date(sem.startDate).toLocaleDateString() : 'Not set'}</p>
                    <p>End: {sem.endDate ? new Date(sem.endDate).toLocaleDateString() : 'Not set'}</p>
                  </div>
                </div>
                <Badge className={statusStyles[sem.status]}>{statusLabels[sem.status]}</Badge>
              </div>
            </div>
          );
        })}
        {semesters.length === 0 && <div className="rounded-lg border-2 border-dashed p-12 text-center text-sm text-[var(--muted-foreground)]">No semesters found for this batch.</div>}
      </div>
    </div>
  );
}
