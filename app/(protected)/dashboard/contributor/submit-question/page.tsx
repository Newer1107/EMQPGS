import { PageHeader } from "@/components/dashboard/page-header";
import { QuestionFormWrapper } from "./question-form-wrapper";
import { NextStepGuidance } from "@/components/forms/next-step-guidance";
import { getWorkspaceContext } from "@/lib/auth/get-workspace-context";

export default async function ContributorSubmitQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; marks?: string; subjectVersionId?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  const { context: ctx } = await getWorkspaceContext("CONTRIBUTOR");
  const versionId = ctx.subjectVersion?.id ?? "";

  const slotData = ctx.questionBank.slots.map((s) => ({
    moduleNumber: s.moduleNumber,
    marks: s.marks,
    slotNumber: s.slotNumber,
    filled: s.assignedQuestion !== null,
  }));

  const initialValues =
    params.module && params.marks
      ? { moduleNumber: Number(params.module), marks: Number(params.marks), subjectVersionId: versionId }
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Submit Question — ${ctx.subject.subjectName}`}
        description={`${ctx.subject.subjectCode} · Semester ${ctx.batchSemester.semesterNumber} · ${ctx.batchSemester.academicYear.code}`}
      />
      {params.submitted === "true" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Question submitted successfully! You can submit another below.
        </div>
      )}
      {initialValues && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Creating question for Module {initialValues.moduleNumber}, {initialValues.marks} marks.
        </div>
      )}
      <NextStepGuidance context="question_created" />
      <QuestionFormWrapper
        subjectVersions={[{ id: versionId, title: ctx.subject.subjectName, subject: { subjectCode: ctx.subject.subjectCode, subjectName: ctx.subject.subjectName } }]}
        endpoint="/api/question-library"
        title="Create Question"
        redirectOnSuccess="/dashboard/contributor/questions"
        initialValues={initialValues}
        slotDataMap={{ [versionId]: slotData }}
        bankIdBySubjectVersionId={{ [versionId]: ctx.bankId }}
        currentSubjectVersionId={params.subjectVersionId}
      />
    </div>
  );
}
