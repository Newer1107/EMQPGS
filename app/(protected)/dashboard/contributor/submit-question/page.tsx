import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { QuestionForm } from "@/components/forms/question-form";
import { NextStepGuidance } from "@/components/forms/next-step-guidance";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { getContributorAssignedBanks } from "@/lib/server-data";

export default async function ContributorSubmitQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; marks?: string; subjectVersionId?: string }>;
}) {
  const params = await searchParams;
  const actor = await getCurrentUserFromCookies();
  const banks = await getContributorAssignedBanks(actor.id);

  const assignedSubjectVersions = banks
    .flatMap((b) => b.subject.versions.map((v) => ({ id: v.id, title: v.title, subject: { subjectCode: b.subject.subjectCode, subjectName: b.subject.subjectName } })))
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
    .sort((a, b) => a.subject.subjectName.localeCompare(b.subject.subjectName));

  if (assignedSubjectVersions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Submit Question" description="Create a new question for a subject you are assigned to." />
        <Card>
          <CardContent className="py-12">
            <EmptyState
              message="No subjects assigned"
              description="You have not been assigned to any question banks. Contact your coordinator to get started."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const initialValues =
    params.module && params.marks
      ? {
          moduleNumber: Number(params.module),
          marks: Number(params.marks),
          subjectVersionId: params.subjectVersionId ?? undefined,
        }
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit Question"
        description="Create a new question for one of your assigned subjects."
      />
      {initialValues && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Creating question for Module {initialValues.moduleNumber}, {initialValues.marks} marks.
        </div>
      )}
      <NextStepGuidance context="question_created" />
      <QuestionForm
        subjectVersions={assignedSubjectVersions}
        endpoint="/api/question-library"
        title="Create Question"
        redirectOnSuccess="/dashboard/contributor/questions"
        initialValues={initialValues}
      />
    </div>
  );
}
