import { prisma } from "@/lib/db";
import { QuestionForm } from "@/components/forms/question-form";
import { NextStepGuidance } from "@/components/forms/next-step-guidance";

export default async function ContributorSubmitQuestionPage() {
  const subjectVersions = await prisma.subjectVersion.findMany({
    where: { status: "ACTIVE" },
    include: { subject: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create Question</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create a new question in the question library.</p>
      </div>
      <NextStepGuidance context="question_created" />
      <QuestionForm
        subjectVersions={subjectVersions}
        endpoint="/api/question-library"
        title="Create Question"
        redirectOnSuccess="/dashboard/contributor/questions"
      />
    </div>
  );
}
