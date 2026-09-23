import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";

export const sourceInclude = {
  subject: { select: { subjectCode: true, subjectName: true, departmentId: true } },
  pattern: true,
  auditBlueprints: { orderBy: { version: "desc" as const }, take: 1, select: { id: true, version: true } },
  slots: { include: { assignedQuestion: true }, orderBy: { id: "asc" as const } },
} satisfies Prisma.QuestionBankInclude;
type SourceBank = Prisma.QuestionBankGetPayload<{ include: typeof sourceInclude }>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const mappings = (value: Prisma.JsonValue | null): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").sort() : [];

export function buildReviewSource(bank: SourceBank) {
  const questions = [...new Map(bank.slots.flatMap(slot => {
    const q = slot.assignedQuestion;
    if (!q) return [];
    const fields = {
      id: q.id, questionText: q.questionText, moduleNumber: q.moduleNumber, marks: q.marks,
      coMapping: q.coMapping, poMapping: mappings(q.poMapping), piMapping: mappings(q.piMapping),
      rbtLevel: q.rbtLevel, difficultyLevel: q.difficultyLevel, questionType: q.questionType,
    };
    return [[q.id, { ...fields, questionVersion: hash({ ...fields, subjectVersionId: q.subjectVersionId, updatedAt: q.updatedAt.toISOString(), status: q.status }) }] as const];
  })).values()].sort((a, b) => a.id.localeCompare(b.id));
  const slots = bank.slots.map(slot => ({ id: slot.id, moduleNumber: slot.moduleNumber, marks: slot.marks, slotNumber: slot.slotNumber, assignedQuestionId: slot.assignedQuestionId })).sort((a, b) => a.id.localeCompare(b.id));
  return {
    bank: { id: bank.id, subjectName: bank.subject.subjectName, subjectCode: bank.subject.subjectCode, departmentId: bank.subject.departmentId },
    totalSlots: bank.pattern?.totalSlots ?? bank.slots.length,
    blueprintId: bank.auditBlueprints[0]?.id ?? null,
    bankFingerprint: hash({ bankId: bank.id, version: bank.version, subject: bank.subject, pattern: bank.pattern, blueprint: bank.auditBlueprints[0] ?? null, slots, questionVersions: questions.map(q => [q.id, q.questionVersion]) }),
    questions, slots,
  };
}
export type ReviewSource = ReturnType<typeof buildReviewSource>;
export async function loadReviewSource(db: Prisma.TransactionClient, bankId: string): Promise<ReviewSource> {
  const bank = await db.questionBank.findUnique({ where: { id: bankId }, include: sourceInclude });
  if (!bank) throw new NotFoundError("Question bank not found.");
  return buildReviewSource(bank);
}

export function attributeHasValue(question: ReviewSource["questions"][number], attribute: string): boolean {
  const value = attribute === "questionId" ? question.id : question[attribute as keyof typeof question];
  return Array.isArray(value) ? value.length > 0 : typeof value === "number" ? value > 0 : typeof value === "string" && value.trim().length > 0;
}
