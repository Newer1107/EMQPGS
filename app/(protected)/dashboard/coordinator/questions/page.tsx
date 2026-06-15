import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionStatusLabels } from "@/lib/constants";

export default async function CoordinatorQuestionsPage() {
  const actor = await getCurrentUserFromCookies();
  const deptUtils = new DepartmentAccessUtils();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(actor);

  const questions = await prisma.questionLibraryItem.findMany({
    where: {
      subjectVersion: {
        subject: { departmentId: { in: departmentIds } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      subjectVersion: { include: { subject: true } },
      creator: { select: { id: true, name: true } },
      bankLinks: { include: { questionBank: { include: { examCycle: { select: { examType: true } } } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contribution Monitor</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Read-only view of question contribution progress across all banks.</p>
      </div>
      <DataTableCard title="Question Library">
        <Table>
          <THead><TR><TH>Subject</TH><TH>Module</TH><TH>Marks</TH><TH>Status</TH><TH>Contributor</TH><TH>Linked Banks</TH></TR></THead>
          <TBody>
            {questions.map((question) => (
              <TR key={question.id}>
                <TD className="font-medium">{question.subjectVersion.subject.subjectCode}</TD>
                <TD>{question.moduleNumber}</TD>
                <TD>{question.marks}</TD>
                <TD><Badge>{questionStatusLabels[question.status] ?? question.status}</Badge></TD>
                <TD>{question.creator.name}</TD>
                <TD>{question.bankLinks.map((link) => link.questionBank.examCycle.examType).join(", ") || "None"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
