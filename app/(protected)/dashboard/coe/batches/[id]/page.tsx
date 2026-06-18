import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const metadata: Metadata = { title: "Batch — EMQPGS" };

export default async function BatchOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: { programme: { include: { homeAcademicUnit: true } }, curriculumScheme: true },
  });
  if (!batch) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.name}
        description="Batch overview and details"
        className="!flex-row !items-center !gap-3"
      />
      <div className="-mt-4 flex gap-1 border-b">
        <span className="border-b-2 border-black px-4 py-2 text-sm font-medium">Overview</span>
        <Link href={`/dashboard/coe/batches/${id}/semesters`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Semesters</Link>
        <Link href={`/dashboard/coe/batches/${id}/teaching-groups`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Teaching Groups</Link>
        <Link href={`/dashboard/coe/batches/${id}/history`} className="px-4 py-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">History</Link>
        <Badge variant={batch.status === "GRADUATED" ? "info" : "success"} className="self-center ml-2">
          {batch.status === "GRADUATED" ? "Graduated" : "Active"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">Programme</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{batch.programme?.name ?? '-'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">Curriculum Scheme</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{batch.curriculumScheme?.name} ({batch.curriculumScheme?.year})</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">Current Semester</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{batch.currentSemesterNumber ? `Semester ${batch.currentSemesterNumber}` : 'Not started'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">Current Academic Unit</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{batch.currentSemesterNumber && batch.currentSemesterNumber <= 2 ? batch.programme?.firstYearAcademicUnitId : batch.programme?.homeAcademicUnit?.name ?? '-'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">Admission Year</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{batch.admissionYear}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)]">Graduation Year</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{batch.graduationYear}</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
