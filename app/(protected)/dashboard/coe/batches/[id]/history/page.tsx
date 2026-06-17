import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = { title: "Batch History — EMQPGS" };

export default async function BatchHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/coe/batches" className="text-sm text-[var(--muted-foreground)] underline">← Batches</Link>
        <h1 className="text-2xl font-semibold">{batch.name}</h1>
        <Badge>{batch.status}</Badge>
      </div>

      <div className="flex gap-1 border-b">
        <Link href={"/dashboard/coe/batches/" + id} className="px-4 py-2 text-sm text-[var(--muted-foreground)]">Overview</Link>
        <Link href={"/dashboard/coe/batches/" + id + "/semesters"} className="px-4 py-2 text-sm text-[var(--muted-foreground)]">Semesters</Link>
        <Link href={"/dashboard/coe/batches/" + id + "/teaching-groups"} className="px-4 py-2 text-sm text-[var(--muted-foreground)]">Teaching Groups</Link>
        <Link href={"/dashboard/coe/batches/" + id + "/history"} className="border-b-2 border-black px-4 py-2 text-sm font-medium">History</Link>
      </div>

      <div className="rounded-lg border-2 border-dashed p-12 text-center">
        <h3 className="text-lg font-medium text-[var(--muted-foreground)]">Coming Soon</h3>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Semester progression history, exam cycle history, and batch archive will appear here.
          This tab is ready for future integration.
        </p>
      </div>
    </div>
  );
}
