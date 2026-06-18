import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionStatusLabels } from "@/lib/constants";
import { ActionButton } from "@/components/forms/action-button";
import { NextStepGuidance } from "@/components/forms/next-step-guidance";

const statusVariants: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  APPROVED: "success",
  REJECTED: "danger",
  PENDING: "warning",
  DRAFT: "warning",
  REVISION_REQUESTED: "info",
  REVISION_SUBMITTED: "info",
};

export default async function ContributorQuestionsPage() {
  const actor = await getCurrentUserFromCookies();
  const questions = await prisma.questionLibraryItem.findMany({
    where: { createdById: actor.id },
    orderBy: { createdAt: "desc" },
    include: {
      subjectVersion: {
        include: { subject: true, effectiveFromAcademicYear: true },
      },
      slotAssignments: {
        include: { questionBank: { select: { id: true, examCycle: { select: { examType: true } } } } },
      },
    },
  });

  const latestQuestion = questions.length > 0 ? questions[0] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Questions"
        description="Questions you have created in the question library."
        actions={
          <Link href="/dashboard/contributor/submit-question">
            <Button>Create Question</Button>
          </Link>
        }
      />

      {latestQuestion && (latestQuestion.status === "DRAFT" || latestQuestion.status === "REVISION_SUBMITTED") && (
        <NextStepGuidance context="question_submitted" />
      )}

      <DataTableCard title="Question Library">
        <Table>
          <THead><TR><TH>Subject</TH><TH>Module</TH><TH>Marks</TH><TH>Status</TH><TH>Linked Banks</TH><TH>Actions</TH></TR></THead>
          <TBody>
            {questions.map((question) => (
              <TR key={question.id} id={question.id === latestQuestion?.id && question.status === "DRAFT" ? "new-question" : undefined}>
                <TD className="font-medium">{question.subjectVersion.subject.subjectCode}</TD>
                <TD>{question.moduleNumber}</TD>
                <TD>{question.marks}</TD>
                <TD><Badge variant={statusVariants[question.status] ?? "default"}>{questionStatusLabels[question.status as keyof typeof questionStatusLabels] ?? question.status}</Badge></TD>
                <TD>{question.slotAssignments.map((s) => s.questionBank.examCycle.examType).join(", ") || "None"}</TD>
                <TD>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/contributor/questions/${question.id}/edit`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                    {(question.status === "DRAFT") && (
                      <ActionButton
                        label="Submit"
                        endpoint={`/api/question-library/${question.id}?action=submit`}
                        method="POST"
                        confirmMessage="Submit this question for moderation?"
                        successMessage="Question submitted"
                        size="sm"
                      />
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

