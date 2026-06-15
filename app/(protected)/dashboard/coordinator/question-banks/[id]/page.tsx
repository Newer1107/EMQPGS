import { notFound } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionBankStatusLabels, questionStatusLabels, difficultyLabels } from "@/lib/constants";
import { BankActionsPanel } from "@/components/forms/bank-actions-panel";
import { SlotCoverageDashboard } from "@/components/forms/slot-coverage-dashboard";
import { WorkflowTimeline } from "@/components/forms/workflow-timeline";
import { NextStepGuidance } from "@/components/forms/next-step-guidance";

export default async function QuestionBankDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();
  const bankService = new QuestionBankWorkflowService();
  const bank = await bankService.getQuestionBankDetail(actor, id);
  if (!bank) notFound();

  const questions = bank.bankQuestions.map((bq: { question: { id: string; moduleNumber: number; marks: number; status: string } }) => ({
    id: bq.question.id,
    moduleNumber: bq.question.moduleNumber,
    marks: bq.question.marks,
    status: bq.question.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{bank.subject.subjectName}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {bank.subject.subjectCode} · {bank.subject.department.name} · {bank.examCycle.examType} · {bank.examCycle.semester.name} ({bank.examCycle.academicYear.code})
        </p>
      </div>

      <NextStepGuidance context={
        bank.status === "IN_PROGRESS" ? "bank_created" :
        bank.status === "UNDER_MODERATION" ? "bank_submitted" :
        bank.status === "MODERATED" ? "moderation_complete" :
        bank.status === "REPORT_GENERATED" ? "report_generated" :
        bank.status === "APPROVED" ? "bank_approved" :
        bank.status === "LOCKED" ? "bank_locked" : ""
      } />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SlotCoverageDashboard questions={questions} />

          <Card>
            <CardHeader>
              <CardTitle>
                Questions ({bank.bankQuestions.length})
                <Badge className="ml-2">{questionBankStatusLabels[bank.status] ?? bank.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead><TR><TH>Module</TH><TH>Marks</TH><TH>Question</TH><TH>CO</TH><TH>RBT</TH><TH>Difficulty</TH><TH>Status</TH><TH>Creator</TH></TR></THead>
                <TBody>
                  {bank.bankQuestions.map((bq: { id: string; question: { id: string; moduleNumber: number; marks: number; questionText: string; coMapping: string; rbtLevel: string; difficultyLevel: string | null; status: string; creator: { name: string }; subjectVersion: { subject: { subjectCode: string } } } }) => (
                    <TR key={bq.id}>
                      <TD>{bq.question.moduleNumber}</TD>
                      <TD>{bq.question.marks}</TD>
                      <TD className="max-w-xs truncate">{bq.question.questionText}</TD>
                      <TD>{bq.question.coMapping}</TD>
                      <TD>{bq.question.rbtLevel}</TD>
                      <TD>{bq.question.difficultyLevel ? difficultyLabels[bq.question.difficultyLevel as keyof typeof difficultyLabels] : "-"}</TD>
                      <TD><Badge>{questionStatusLabels[bq.question.status as keyof typeof questionStatusLabels] ?? bq.question.status}</Badge></TD>
                      <TD>{bq.question.creator.name}</TD>
                    </TR>
                  ))}
                  {bank.bankQuestions.length === 0 && (
                    <TR><TD colSpan={8} className="text-center text-sm text-[var(--muted-foreground)]">No questions in this bank yet</TD></TR>
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          {bank.generatedPapers.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Generated Papers ({bank.generatedPapers.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <THead><TR><TH>Variant</TH><TH>Status</TH><TH>Coverage</TH><TH>Difficulty</TH><TH>Quality</TH><TH>Generated</TH></TR></THead>
                  <TBody>
                    {bank.generatedPapers.map((paper: { id: string; variant: string; status: string; coverageScore: number | null; difficultyScore: number | null; qualityScore: number | null; generatedAt: Date | null }) => (
                      <TR key={paper.id}>
                        <TD className="font-medium">{paper.variant}</TD>
                        <TD><Badge>{paper.status}</Badge></TD>
                        <TD>{paper.coverageScore != null ? `${(paper.coverageScore * 100).toFixed(0)}%` : "-"}</TD>
                        <TD>{paper.difficultyScore != null ? `${(paper.difficultyScore * 100).toFixed(0)}%` : "-"}</TD>
                        <TD>{paper.qualityScore != null ? `${(paper.qualityScore * 100).toFixed(0)}%` : "-"}</TD>
                        <TD>{paper.generatedAt ? new Date(paper.generatedAt).toLocaleString() : "-"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {bank.aiReports.length > 0 && (
            <Card>
              <CardHeader><CardTitle>AI Reports</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {bank.aiReports.map((report: { id: string; status: string; summary: string | null; modelName: string | null; createdAt: Date }) => (
                    <li key={report.id} className="flex items-center justify-between">
                      <span>{report.modelName ?? "Analysis"} · {new Date(report.createdAt).toLocaleDateString()}</span>
                      <Badge>{report.status}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {bank.deanReview && (
            <Card>
              <CardHeader><CardTitle>Dean Review</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Regular Paper: <span className="font-medium">{bank.deanReview.regularPaper}</span></p>
                <p>Supplementary Paper: <span className="font-medium">{bank.deanReview.supplementaryPaper}</span></p>
                <p>KT Paper: <span className="font-medium">{bank.deanReview.ktPaper}</span></p>
                <p className="text-[var(--muted-foreground)]">Reviewed by {bank.deanReview.reviewedBy.name} on {new Date(bank.deanReview.reviewedAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <BankActionsPanel
            questionBankId={id}
            currentStatus={bank.status}
            hasAiReports={bank.aiReports.length > 0}
            hasPapers={bank.generatedPapers.length > 0}
          />
          <WorkflowTimeline currentStatus={bank.status} />
        </div>
      </div>
    </div>
  );
}
