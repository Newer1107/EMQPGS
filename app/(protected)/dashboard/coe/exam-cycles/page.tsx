import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Exam Cycles</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Exam cycles represent examination events. Select a batch semester and exam type to create one.
        </p>
      </div>

      <DataTableCard title="All Exam Cycles">
        <Table>
          <THead>
            <TR><TH>Batch</TH><TH>Semester</TH><TH>Academic Unit</TH><TH>Exam Type</TH><TH>Status</TH><TH>Banks</TH></TR>
          </THead>
          <TBody>
            {cycles.length === 0 && <TR><TD colSpan={6} className="text-center text-muted-foreground py-8">No exam cycles found.</TD></TR>}
            {cycles.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.batchSemester?.batch?.name ?? '-'}</TD>
                <TD><Badge className="bg-gray-100 text-gray-700 border-gray-200">Semester {c.batchSemester?.semesterNumber ?? '-'}</Badge></TD>
                <TD>{c.batchSemester?.academicUnit?.name ?? '-'}</TD>
                <TD>{c.examType.replace('_', ' ')}</TD>
                <TD><Badge>{c.status}</Badge></TD>
                <TD>{c._count.questionBanks}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
