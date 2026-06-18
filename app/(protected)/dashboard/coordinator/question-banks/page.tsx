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
import { SimpleForm } from "@/components/dashboard/simple-form";

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
    subjectService.listSubjects(actor, { status: "ACTIVE" }),
    prisma.examCycle.findMany({
      where: { status: ExamCycleStatus.ACTIVE },
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
            <THead><TR><TH>Subject</TH><TH>Cycle</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
            <TBody>
              {(questionBanks).map((bank) => (
                <TR key={bank.id}>
                  <TD className="font-medium">{bank.subject?.subjectCode ?? '-'}</TD>
                  <TD>Sem {bank.examCycle?.batchSemester?.semesterNumber ?? '-'} · {bank.examCycle?.batchSemester?.academicYear?.code ?? '-'}</TD>
                  <TD><Badge variant={phaseVariants[bank.phase] ?? "default"}>{questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}</Badge></TD>
                  <TD>
                    <Link href={`/dashboard/coordinator/question-banks/${bank.id}`}>
                      <Button variant="outline" size="sm">Manage</Button>
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Create Question Bank"
          endpoint="/api/question-banks"
          fields={[
            { name: "subjectId", label: "Subject", type: "select", options: (subjects as Array<{ id: string; subjectCode: string; subjectName: string }>).map((subject) => ({ value: subject.id, label: `${subject.subjectCode} - ${subject.subjectName}` })) },
            { name: "examCycleId", label: "Exam Cycle", type: "select", options: (examCycles).map((cycle) => ({ value: cycle.id, label: `Sem ${cycle.batchSemester?.semesterNumber ?? '-'} · ${cycle.batchSemester?.academicYear?.code ?? '-'} / ${cycle.examType}` })) },
          ]}
        />
      </div>
    </div>
  );
}


