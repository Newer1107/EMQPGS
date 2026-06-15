import Link from "next/link";
import { ExamCycleStatus } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { questionBankStatusLabels } from "@/lib/constants";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";
import { SimpleForm } from "@/components/dashboard/simple-form";

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
      where: {
        departmentId: { in: departmentIds },
        status: ExamCycleStatus.ACTIVE,
      },
      include: { academicYear: true, semester: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Question Banks</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage question banks for each subject and exam cycle</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Question Banks">
          <Table>
            <THead><TR><TH>Subject</TH><TH>Cycle</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
            <TBody>
              {(questionBanks as unknown as Array<{ id: string; status: import("@prisma/client").QuestionBankStatus; subject: { subjectCode: string }; examCycle: { semester: { name: string }; academicYear: { code: string } } }>).map((bank) => (
                <TR key={bank.id}>
                  <TD className="font-medium">{bank.subject.subjectCode}</TD>
                  <TD>{bank.examCycle.semester.name} · {bank.examCycle.academicYear.code}</TD>
                  <TD><Badge>{questionBankStatusLabels[bank.status as import("@prisma/client").QuestionBankStatus] ?? bank.status}</Badge></TD>
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
            { name: "examCycleId", label: "Exam Cycle", type: "select", options: (examCycles as Array<{ id: string; semester: { name: string }; academicYear: { code: string }; examType: string }>).map((cycle) => ({ value: cycle.id, label: `${cycle.semester.name} · ${cycle.academicYear.code} / ${cycle.examType}` })) },
          ]}
        />
      </div>
    </div>
  );
}
