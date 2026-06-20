import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = { title: "Batch Semesters — EMQPGS" };

const statusVariants: Record<string, "success" | "warning" | "info" | "default"> = {
  UPCOMING: "warning",
  ACTIVE: "success",
  COMPLETED: "info",
};
const statusLabels: Record<string, string> = { UPCOMING: 'Upcoming', ACTIVE: 'Active', COMPLETED: 'Completed' };

export default async function BatchSemestersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({ where: { id }, include: { department: true } });
  if (!batch) notFound();

  const semesters = await prisma.batchSemester.findMany({
    where: { batchId: id },
    orderBy: { semesterNumber: "asc" },
    include: { academicYear: true, department: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/dashboard/coe/batches" className="hover:text-[var(--text-primary)] transition-colors">Batches</Link>
        <span>/</span>
        <Link href={`/dashboard/coe/batches/${id}`} className="hover:text-[var(--text-primary)] transition-colors">{batch.name}</Link>
        <span>/</span>
        <span className="font-medium text-[var(--text-primary)]">Semesters</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Semesters — {batch.name}</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)] max-w-2xl">
          A semester is one teaching period for this batch. Configure start and end dates, activate when teaching begins,
          and mark complete when it ends.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        <Link href={`/dashboard/coe/batches/${id}`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Overview</Link>
        <Link href={`/dashboard/coe/batches/${id}/semesters`} className="border-b-2 border-black px-4 py-2 text-sm font-medium">Semesters</Link>
        <Link href={`/dashboard/coe/batches/${id}/teaching-groups`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Teaching Groups</Link>
        <Link href={`/dashboard/coe/batches/${id}/history`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">History</Link>
        <Badge variant={batch.status === "GRADUATED" ? "info" : "success"} className="ml-auto self-center">
          {batch.status === "GRADUATED" ? "Graduated" : "Active"}
        </Badge>
      </div>

      <div className="space-y-3">
        {semesters.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">No semesters configured yet</p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Semesters are created automatically when this batch activates. Activate the batch from the overview page to generate all semesters at once.</p>
          </div>
        )}
        {semesters.map((sem) => {
          const isCurrent = sem.status === "ACTIVE";
          return (
            <div key={sem.id} className={`rounded-lg border p-5 transition-all ${isCurrent ? 'border-green-400 bg-green-50 ring-2 ring-green-200' : 'bg-white'}`}>
              {isCurrent && <div className="mb-2 inline-block rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-semibold text-white">Current Semester</div>}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Semester {sem.semesterNumber}</h3>
                  <div className="mt-1 space-y-0.5 text-sm text-[var(--text-tertiary)]">
                    <p>Academic Year: {sem.academicYear?.code ?? '-'}</p>
                    <p>Department: {sem.department?.name ?? '-'}</p>
                    <p>Start: {sem.startDate ? new Date(sem.startDate).toLocaleDateString() : 'Not set'}</p>
                    <p>End: {sem.endDate ? new Date(sem.endDate).toLocaleDateString() : 'Not set'}</p>
                  </div>
                </div>
                <Badge variant={statusVariants[sem.status] ?? "default"}>{statusLabels[sem.status]}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
