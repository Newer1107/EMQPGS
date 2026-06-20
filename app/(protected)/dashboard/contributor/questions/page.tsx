import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { Button } from "@/components/ui/button";
import { NextStepGuidance } from "@/components/forms/next-step-guidance";
import { QuestionsList } from "@/components/contributor/questions-list";

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
        include: { questionBank: { select: { id: true, batchSemester: { select: { semesterNumber: true } } } } },
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

      <QuestionsList questions={questions as never} latestQuestionId={latestQuestion?.id} />
    </div>
  );
}

