import { notFound } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { questionBankPhaseLabels, recordStatusLabels, questionStatusLabels, difficultyLabels } from "@/lib/constants";
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

  const slots = bank.slots as Array<{ assignedQuestion: { id: string; moduleNumber: number; marks: number; status: string } | null }>;
  const questions = slots
    .filter((s) => s.assignedQuestion)
    .map((s) => ({
      id: s.assignedQuestion!.id,
      moduleNumber: s.assignedQuestion!.moduleNumber,
      marks: s.assignedQuestion!.marks,
      status: s.assignedQuestion!.status,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{bank.subject.subjectName}</h1>
          <p className="text-muted-foreground">
            {bank.subject.subjectCode} &middot; {bank.examCycle.academicYear.code} &middot; Sem {bank.examCycle.semester.number} &middot; {bank.examCycle.examType.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{questionBankPhaseLabels[bank.phase] ?? bank.phase}</Badge>
          <Badge className={bank.recordStatus === "LOCKED" ? "bg-red-100 text-red-800 border-red-300" : ""}>{recordStatusLabels[bank.recordStatus] ?? bank.recordStatus}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SlotCoverageDashboard questions={questions} />
          <Card>
            <CardHeader>
              <CardTitle>Questions ({questions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Module</TH>
                    <TH>Marks</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {questions.map((question) => (
                    <TR key={question.id}>
                      <TD>{question.moduleNumber}</TD>
                      <TD>{question.marks}</TD>
                      <TD><Badge>{questionStatusLabels[question.status as keyof typeof questionStatusLabels] ?? question.status}</Badge></TD>
                    </TR>
                  ))}
                  {questions.length === 0 && (
                    <TR>
                      <TD colSpan={3} className="text-center text-muted-foreground py-4">No questions assigned yet.</TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <BankActionsPanel questionBankId={bank.id} phase={bank.phase} recordStatus={bank.recordStatus} />
          <WorkflowTimeline phase={bank.phase} recordStatus={bank.recordStatus} />
          <NextStepGuidance phase={bank.phase} recordStatus={bank.recordStatus} />
        </div>
      </div>
    </div>
  );
}
