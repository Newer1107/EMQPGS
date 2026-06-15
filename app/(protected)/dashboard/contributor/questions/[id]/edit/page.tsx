import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { QuestionForm } from "@/components/forms/question-form";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();

  const question = await prisma.questionLibraryItem.findUnique({
    where: { id },
    include: { subjectVersion: { include: { subject: true } } },
  });
  if (!question) notFound();
  if (question.createdById !== actor.id) return <div className="p-6 text-center text-red-600">You can only edit your own questions.</div>;

  const subjectVersions = await prisma.subjectVersion.findMany({
    where: { status: "ACTIVE" },
    include: { subject: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const isRevisionRequested = question.status === "REVISION_REQUESTED";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit Question</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {isRevisionRequested ? "A moderator has requested changes. After editing, use 'Save & Submit' to resubmit." : "Update your question in the library."}
        </p>
      </div>
      <QuestionForm
        initialValues={{
          subjectVersionId: question.subjectVersionId,
          moduleNumber: question.moduleNumber,
          marks: question.marks,
          questionText: question.questionText,
          coMapping: question.coMapping,
          rbtLevel: question.rbtLevel,
          difficultyLevel: question.difficultyLevel ?? undefined,
          teachingIndex: question.teachingIndex ?? undefined,
        }}
        subjectVersions={subjectVersions}
        endpoint={`/api/question-library/${id}`}
        title="Update Question"
        method="PATCH"
        redirectOnSuccess="/dashboard/contributor/questions"
        submitAfterSave={isRevisionRequested}
        submitEndpoint="/api/question-library"
      />
    </div>
  );
}
