import Link from "next/link";
import { ExamCycleStatus } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { questionBankPhaseLabels } from "@/lib/constants";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";
import { CreateBankForm } from "./create-bank-form";

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
  const subjectService = new SubjectManagementService();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(actor);
  const [questionBanks, subjects, examCycles] = await Promise.all([
    bankService.listQuestionBanks(actor),
    subjectService.getSubjectsForBankForm(actor),
    prisma.examCycle.findMany({
      where: { status: ExamCycleStatus.ACTIVE, batchSemester: { departmentId: { in: departmentIds } } },
      include: { batchSemester: { include: { academicYear: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Banks"
        description="Manage question banks for each subject and exam cycle"
      />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Question Banks">
          <Table>
            <THead><TR><TH>Subject</TH><TH>Cycle</TH><TH>Status</TH><TH>Progress</TH><TH>Actions</TH></TR></THead>
            <TBody>
              {(questionBanks as Array<{ id: string; phase: string; filledSlots?: number; totalSlots?: number; subject?: { subjectCode: string } | null; examCycle?: { batchSemester?: { semesterNumber: number; academicYear?: { code: string } } } | null }>).map((bank) => {
                const filled = (bank as any).filledSlots ?? 0;
                const total = (bank as any).totalSlots ?? 0;
                const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                return (
                <TR key={bank.id}>
                  <TD className="font-medium">{bank.subject?.subjectCode ?? '-'}</TD>
                  <TD>Sem {bank.examCycle?.batchSemester?.semesterNumber ?? '-'} · {bank.examCycle?.batchSemester?.academicYear?.code ?? '-'}</TD>
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
        <CreateBankForm subjects={subjects} examCycles={examCycles} />
      </div>
    </div>
  );
}


