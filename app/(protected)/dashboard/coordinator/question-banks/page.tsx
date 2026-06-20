import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { questionBankPhaseLabels } from "@/lib/constants";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";

const phaseVariants: Record<string, "success" | "warning" | "info" | "default"> = {
  COMPLETE: "success",
  DRAFTING: "warning",
  MODERATION: "info",
  APPROVAL: "info",
};

export default async function QuestionBanksManagementPage() {
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();
  const bankService = new QuestionBankWorkflowService();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(actor);
  const questionBanks = await bankService.listQuestionBanks(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assigned Question Banks"
        description="Annual question banks for your departments — one per subject per semester."
      />
      <DataTableCard title="Question Banks">
        <Table>
          <THead><TR><TH>Subject</TH><TH>Semester</TH><TH>Status</TH><TH>Progress</TH><TH>Actions</TH></TR></THead>
          <TBody>
            {(questionBanks as Array<{ id: string; phase: string; filledSlots?: number; totalSlots?: number; subject?: { subjectCode: string } | null; batchSemester?: { semesterNumber: number; academicYear?: { code: string } } | null }>).map((bank) => {
              const filled = (bank as any).filledSlots ?? 0;
              const total = (bank as any).totalSlots ?? 0;
              const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
              return (
              <TR key={bank.id}>
                <TD className="font-medium">{bank.subject?.subjectCode ?? '-'}</TD>
                <TD>Sem {bank.batchSemester?.semesterNumber ?? '-'} · {bank.batchSemester?.academicYear?.code ?? '-'}</TD>
                <TD><Badge variant={phaseVariants[bank.phase] ?? "default"}>{questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}</Badge></TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium tabular-nums">{filled}/{total}</span>
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                      <div className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-amber-500" : "bg-gray-300"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </TD>
                <TD>
                  <Link href={`/dashboard/coordinator/question-banks/${bank.id}`}>
                    <Button variant="outline" size="sm">Manage</Button>
                  </Link>
                </TD>
              </TR>
            )})}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
