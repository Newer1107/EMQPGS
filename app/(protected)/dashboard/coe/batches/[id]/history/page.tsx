import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = { title: "Batch History — EMQPGS" };

export default async function BatchHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: { batchSemesters: {
      orderBy: { semesterNumber: "desc" },
      include: { academicYear: true, examCycles: { orderBy: { createdAt: "desc" } } },
    } },
  });
  if (!batch) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/coe/batches" className="text-sm text-[var(--text-tertiary)] underline">← Batches</Link>
        <h1 className="text-2xl font-semibold">{batch.name}</h1>
        <Badge>{batch.status}</Badge>
      </div>

      <div className="flex gap-1 border-b">
        <Link href={"/dashboard/coe/batches/" + id} className="px-4 py-2 text-sm text-[var(--text-tertiary)]">Overview</Link>
        <Link href={"/dashboard/coe/batches/" + id + "/semesters"} className="px-4 py-2 text-sm text-[var(--text-tertiary)]">Semesters</Link>
        <Link href={"/dashboard/coe/batches/" + id + "/teaching-groups"} className="px-4 py-2 text-sm text-[var(--text-tertiary)]">Teaching Groups</Link>
        <Link href={"/dashboard/coe/batches/" + id + "/history"} className="border-b-2 border-black px-4 py-2 text-sm font-medium">History</Link>
      </div>

      <p className="text-sm">Batch created {batch.createdAt.toLocaleDateString()}. Semester and exam cycle records below show their current recorded status.</p>
      {batch.batchSemesters.length === 0 && <p>No semester history recorded for this batch.</p>}
      {batch.batchSemesters.map((semester) => (
        <section key={semester.id} className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Semester {semester.semesterNumber} · {semester.academicYear.code} · {semester.status}</h2>
          <p className="text-sm">{semester.startDate?.toLocaleDateString() ?? "Start not scheduled"} – {semester.endDate?.toLocaleDateString() ?? "End not scheduled"}</p>
          {semester.examCycles.length === 0 ? <p className="text-sm">No exam cycles recorded.</p> : (
            <ul className="space-y-2 text-sm">{semester.examCycles.map((cycle) => (
              <li key={cycle.id}>
                <Link className="underline" href={`/dashboard/coe/exam-cycles/${cycle.id}`}>{cycle.examType}</Link>
                {" · "}{cycle.status}{" · "}{cycle.startDate?.toLocaleDateString() ?? "Start not scheduled"} – {cycle.endDate?.toLocaleDateString() ?? "End not scheduled"}
              </li>
            ))}</ul>
          )}
        </section>
      ))}
    </div>
  );
}
