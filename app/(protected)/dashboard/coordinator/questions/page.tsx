import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionStatusLabels } from "@/lib/constants";

const statusVariants: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  APPROVED: "success",
  REJECTED: "danger",
  PENDING: "warning",
  DRAFT: "warning",
  REVISION_REQUESTED: "info",
  REVISION_SUBMITTED: "info",
};

export default async function CoordinatorQuestionsPage() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  const deptUtils = new DepartmentAccessUtils();
  const departmentIds = await deptUtils.getAssignedDepartmentIds(auth);

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
      slotAssignments: { include: { questionBank: { include: { batchSemester: { select: { semesterNumber: true } } } } } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contribution Monitor"
        description="Read-only view of question contribution progress across all banks."
      />
      <DataTableCard title="Question Library">
        <Table>
          <THead><TR><TH>Subject</TH><TH>Module</TH><TH>Marks</TH><TH>Status</TH><TH>Contributor</TH><TH>Linked Banks</TH><TH>Actions</TH></TR></THead>
          <TBody>
            {questions.map((question) => (
              <TR key={question.id}>
                <TD className="font-medium">{question.subjectVersion.subject.subjectCode}</TD>
                <TD>{question.moduleNumber}</TD>
                <TD>{question.marks}</TD>
                <TD><Badge variant={statusVariants[question.status] ?? "default"}>{questionStatusLabels[question.status as keyof typeof questionStatusLabels] ?? question.status}</Badge></TD>
                <TD>{question.creator.name}</TD>
                <TD>Bank</TD>
                <TD>
                  <Link href={`/dashboard/coordinator/questions/${question.id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
