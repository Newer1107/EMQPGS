import { notFound } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";
import { BankDetailClient, type SlotItem, type AiReportItem, type GeneratedPaperItem, type DeanReviewItem, type ModeratorInfo, type ContributorInfo } from "./bank-detail-client";
import { examTypeLabels } from "@/lib/constants";

export default async function QuestionBankDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();
  const bankService = new QuestionBankWorkflowService();
  const bank = await bankService.getQuestionBankDetail(actor, id);
  if (!bank) notFound();

  const totalModules = bank.pattern?.totalModules ?? 6;
  const marksOptions = (bank.pattern?.marksPattern as number[]) ?? [2, 5, 10];
  const slotsPerModule = bank.pattern?.slotsPerModule ?? 7;
  const totalSlots = bank.pattern?.totalSlots ?? 126;

  const slots: SlotItem[] = (bank.slots ?? []).map((s) => ({
    slotNumber: s.slotNumber,
    moduleNumber: s.moduleNumber,
    marks: s.marks,
    isLocked: s.isLocked,
    assignedQuestion: s.assignedQuestion
      ? {
          id: s.assignedQuestion.id,
          questionText: s.assignedQuestion.questionText,
          status: s.assignedQuestion.status,
          coMapping: s.assignedQuestion.coMapping,
          rbtLevel: s.assignedQuestion.rbtLevel,
          difficultyLevel: s.assignedQuestion.difficultyLevel,
          creator: s.assignedQuestion.creator,
        }
      : null,
  }));

  const aiReports: AiReportItem[] = (bank.aiReports ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    modelName: r.modelName,
    summary: r.summary,
    failureReason: r.failureReason,
    generatedAt: r.generatedAt?.toISOString() ?? null,
  }));

  const generatedPapers: GeneratedPaperItem[] = (bank.generatedPapers ?? []).map((p) => ({
    id: p.id,
    variant: p.variant,
    status: p.status,
    coverageScore: p.coverageScore,
    difficultyScore: p.difficultyScore,
    qualityScore: p.qualityScore,
    duplicateRisk: p.duplicateRisk,
    recommendation: p.recommendation,
    questionCount: p.items.length,
  }));

  let deanReview: DeanReviewItem | null = null;
  if ((bank.deanReview)) {
    deanReview = {
      id: (bank.deanReview).id,
      regularPaper: (bank.deanReview).regularPaper,
      supplementaryPaper: (bank.deanReview).supplementaryPaper,
      ktPaper: (bank.deanReview).ktPaper,
      reviewedBy: (bank.deanReview).reviewedBy.name,
      reviewedAt: (bank.deanReview).reviewedAt.toISOString(),
    };
  }

  const moderators: ModeratorInfo[] = (bank.moderatorAssignments ?? []).map((a) => ({
    id: a.moderator.id,
    name: a.moderator.name,
    email: a.moderator.email,
  }));

  const contributors: ContributorInfo[] = (bank.contributorAssignments ?? []).map((a) => ({
    id: a.contributor.id,
    name: a.contributor.name,
    email: a.contributor.email,
  }));

  const bs = bank.examCycle.batchSemester;

  return (
    <BankDetailClient
      bankId={bank.id}
      subjectName={(bank.subject).subjectName}
      subjectCode={(bank.subject).subjectCode}
      batchName={bs.batch?.name ?? ""}
      semesterNumber={bs.semesterNumber}
      departmentName={bs.department?.name ?? ""}
      academicYearCode={bs.academicYear?.code ?? ""}
      examType={examTypeLabels[bank.examCycle.examType as keyof typeof examTypeLabels] ?? bank.examCycle.examType.replaceAll("_", " ")}
      examCycleLabel={bs.academicYear?.code ? `${bs.academicYear.code} · Sem ${bs.semesterNumber} · ${examTypeLabels[bank.examCycle.examType as keyof typeof examTypeLabels] ?? bank.examCycle.examType.replaceAll("_", " ")}` : ""}
      phase={bank.phase}
      recordStatus={bank.recordStatus}
      userRole={actor.role}
      totalSlots={totalSlots}
      totalModules={totalModules}
      marksOptions={marksOptions}
      slotsPerModule={slotsPerModule}
      slots={slots}
      aiReports={aiReports}
      generatedPapers={generatedPapers}
      deanReview={deanReview}
      moderators={moderators}
      contributors={contributors}
    />
  );
}
