import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
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
          batch: { select: { id: true, name: true, code: true } },
          academicUnit: { select: { id: true, name: true } },
        },
      },
      _count: { select: { questionBanks: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Cycles"
        description="Exam cycles represent examination events. Select a batch semester and exam type to create one."
      />
      <DataTableCard title="All Exam Cycles">
        <Table>
          <THead>
            <TR><TH>Batch</TH><TH>Semester</TH><TH>Academic Unit</TH><TH>Exam Type</TH><TH>Status</TH><TH>Banks</TH></TR>
          </THead>
          <TBody>
            {cycles.length === 0 && (
              <TR><TD colSpan={6}><EmptyState message="No exam cycles found" /></TD></TR>
            )}
            {cycles.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.batchSemester?.batch?.name ?? '-'}</TD>
                <TD><Badge>Semester {c.batchSemester?.semesterNumber ?? '-'}</Badge></TD>
                <TD>{c.batchSemester?.academicUnit?.name ?? '-'}</TD>
                <TD><Badge variant="info">{examTypeLabels[c.examType as keyof typeof examTypeLabels] ?? c.examType.replace('_', ' ')}</Badge></TD>
                <TD><Badge variant={statusVariants[c.status] ?? "default"}>{examCycleStatusLabels[c.status as keyof typeof examCycleStatusLabels] ?? c.status}</Badge></TD>
                <TD>{c._count.questionBanks}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
