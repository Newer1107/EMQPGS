import { getWorkspaceContext } from "@/lib/auth/get-workspace-context";
import { BankSlotsView } from "@/components/dashboard/bank-slots-view";

export default async function ContributorBankPage() {
  const { context: ctx } = await getWorkspaceContext("CONTRIBUTOR");

  const totalModules = ctx.questionBank.pattern?.totalModules ?? 6;
  const marksOptions = (ctx.questionBank.pattern?.marksPattern as number[]) ?? [2, 5, 10];
  const totalSlots = ctx.questionBank.pattern?.totalSlots ?? 126;

  const slots = ctx.questionBank.slots.map((s) => ({
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
          creator: s.assignedQuestion.creator as { id: string; name: string } | null,
        }
      : null,
  }));

  const modules: number[] = [];
  for (let i = 1; i <= totalModules; i++) modules.push(i);

  return (
    <BankSlotsView
      subjectName={ctx.subject.subjectName}
      subjectCode={ctx.subject.subjectCode}
      batchName={ctx.batchSemester.batch.name}
      semesterNumber={ctx.batchSemester.semesterNumber}
      academicYearCode={ctx.batchSemester.academicYear.code}
      totalSlots={totalSlots}
      modules={modules}
      marksOptions={marksOptions}
      slots={slots}
    />
  );
}
