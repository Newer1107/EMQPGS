import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { examTypeLabels, examCycleStatusLabels } from "@/lib/constants";

const statusVariants: Record<string, "success" | "warning" | "default"> = {
  ACTIVE: "success",
  DRAFT: "warning",
  CLOSED: "default",
};

export default async function CoeExamCyclesPage() {
  const cycles = await prisma.examCycle.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      batchSemester: {
        include: {
          batch: { select: { id: true, name: true, code: true, programme: { select: { name: true } } } },
          academicUnit: { select: { id: true, name: true } },
        },
      },
      _count: { select: { questionBanks: true, subjectLinks: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Cycles"
        description="Exam cycles represent examination events linked to a batch and semester."
        actions={
          <Link href="/dashboard/coe/exam-cycles/create">
            <Button>Create Exam Cycle</Button>
          </Link>
        }
      />

      {cycles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Total</p>
            <p className="mt-1 text-2xl font-bold">{cycles.length}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Active</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{cycles.filter((c) => c.status === "ACTIVE").length}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Draft</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{cycles.filter((c) => c.status === "DRAFT").length}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Closed</p>
            <p className="mt-1 text-2xl font-bold text-gray-600">{cycles.filter((c) => c.status === "CLOSED").length}</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Batch</TH>
                <TH>Programme</TH>
                <TH>Semester</TH>
                <TH>Academic Unit</TH>
                <TH>Exam Type</TH>
                <TH>Subjects</TH>
                <TH>Status</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {cycles.length === 0 ? (
                <TR>
                  <TD colSpan={8}>
                    <EmptyState
                      message="No exam cycles have been created yet"
                      description="Exam cycles represent examination events. Each cycle links to a batch semester and exam type, with subjects loaded from the curriculum."
                      action={
                        <Link href="/dashboard/coe/exam-cycles/create">
                          <Button>Create Exam Cycle</Button>
                        </Link>
                      }
                    />
                  </TD>
                </TR>
              ) : (
                cycles.map((c) => (
                  <TR key={c.id} className="cursor-pointer hover:bg-[var(--muted)]">
                    <TD className="font-medium">
                      <Link href={`/dashboard/coe/exam-cycles/${c.id}`} className="hover:underline">
                        {c.batchSemester?.batch?.name ?? '-'}
                      </Link>
                    </TD>
                    <TD>{c.batchSemester?.batch?.programme?.name ?? '-'}</TD>
                    <TD><Badge>Semester {c.batchSemester?.semesterNumber ?? '-'}</Badge></TD>
                    <TD>{c.batchSemester?.academicUnit?.name ?? '-'}</TD>
                    <TD><Badge variant="info">{examTypeLabels[c.examType as keyof typeof examTypeLabels] ?? c.examType.replace('_', ' ')}</Badge></TD>
                    <TD>{c._count.subjectLinks}</TD>
                    <TD><Badge variant={statusVariants[c.status] ?? "default"}>{examCycleStatusLabels[c.status as keyof typeof examCycleStatusLabels] ?? c.status}</Badge></TD>
                    <TD className="text-[var(--muted-foreground)] text-xs">{new Date(c.createdAt).toLocaleDateString()}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
