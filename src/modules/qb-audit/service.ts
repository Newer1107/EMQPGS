import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { AuthContext } from "@/lib/types";
import { evaluate } from "./engine";
import { blueprintSchema, draftSchema, finalizeSchema } from "./validation";
import { sourceHash } from "./source-hash";

type DB = Prisma.TransactionClient;
export function requireAuditAccess(auth: AuthContext, departmentId: string, now = new Date()) {
  if (!auth.user.id || !auth.responsibilities.some(r => r.type === "COORDINATOR" &&
    r.scopeType === "DEPARTMENT" && r.scopeId === departmentId && r.activeFrom <= now &&
    (!r.activeTo || r.activeTo > now))) throw new ForbiddenError("An active coordinator assignment for this bank's department is required.");
}
async function scopedBank(db: DB, auth: AuthContext, id: string) {
  const bank = await db.questionBank.findUnique({ where: { id }, include: { subject: true } });
  if (!bank) throw new NotFoundError("Question bank not found.");
  requireAuditAccess(auth, bank.subject.departmentId);
  return bank;
}
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

/** Append-only persistence. The bank lock serializes blueprint and audit version allocation. */
export class QBAuditService {
  constructor(private readonly db = prisma) {}

  private async write<T>(auth: AuthContext, id: string, operation: (tx: DB) => Promise<T>): Promise<T> {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM QuestionBank WHERE id = ${id} FOR UPDATE`;
      // Protect captured source through commit, including questions shared with other banks.
      await tx.$queryRaw`SELECT id FROM QuestionSlot WHERE questionBankId = ${id} FOR UPDATE`;
      await tx.$queryRaw`SELECT q.id FROM QuestionLibraryItem q INNER JOIN QuestionSlot s ON s.assignedQuestionId = q.id WHERE s.questionBankId = ${id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM ApprovalDecision WHERE questionBankId = ${id} FOR UPDATE`;
      await scopedBank(tx, auth, id);
      return operation(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async get(auth: AuthContext, id: string) {
    return this.db.$transaction(async tx => {
      const bank = await scopedBank(tx, auth, id);
      const [blueprints, snapshots, slots, approvals] = await Promise.all([
        tx.qBAuditBlueprint.findMany({ where: { questionBankId: id }, orderBy: { version: "desc" } }),
        tx.qBAuditSnapshot.findMany({ where: { questionBankId: id }, orderBy: { version: "desc" } }),
        tx.questionSlot.findMany({ where: { questionBankId: id }, include: { assignedQuestion: true }, orderBy: [{ moduleNumber: "asc" }, { slotNumber: "asc" }] }),
        tx.approvalDecision.findMany({ where: { questionBankId: id } }),
      ]);
      const source = { ...this.source(slots), approvals };
      const blueprint = blueprints[0] ? blueprintSchema.parse(blueprints[0].data) : null;
      const hash = sourceHash(source, blueprints[0] ?? null);
      return { bank: { id, subjectName: bank.subject.subjectName, departmentId: bank.subject.departmentId }, blueprints,
        snapshots: snapshots.map(s => ({ ...s, stale: s.status === "DRAFT" && (s.payload as Record<string, unknown>).sourceHash !== hash })),
        preview: evaluate(source, blueprint) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private source(slots: Prisma.QuestionSlotGetPayload<{ include: { assignedQuestion: true } }>[]) {
    return {
      slots: slots.map(s => ({ id: s.id, slotNumber: s.slotNumber, assignedQuestionId: s.assignedQuestionId })),
      questions: [...new Map(slots.flatMap(s => s.assignedQuestion ? [[s.assignedQuestion.id, s.assignedQuestion] as const] : [])).values()],
    };
  }

  async saveBlueprint(auth: AuthContext, id: string, input: unknown) {
    const data = blueprintSchema.parse(input);
    return this.write(auth, id, async tx => {
      const latest = await tx.qBAuditBlueprint.findFirst({ where: { questionBankId: id }, orderBy: { version: "desc" } });
      return tx.qBAuditBlueprint.create({ data: { questionBankId: id, version: (latest?.version ?? 0) + 1, data: json(data), createdById: auth.user.id } });
    });
  }

  async saveDraft(auth: AuthContext, id: string, input: unknown) {
    const request = draftSchema.parse(input);
    return this.write(auth, id, async tx => {
      const [blueprint, slots, latest, approvals] = await Promise.all([
        tx.qBAuditBlueprint.findFirst({ where: { questionBankId: id }, orderBy: { version: "desc" } }),
        tx.questionSlot.findMany({ where: { questionBankId: id }, include: { assignedQuestion: true }, orderBy: [{ moduleNumber: "asc" }, { slotNumber: "asc" }] }),
        tx.qBAuditSnapshot.findFirst({ where: { questionBankId: id }, orderBy: { version: "desc" } }),
        tx.approvalDecision.findMany({ where: { questionBankId: id } }),
      ]);
      const source = { ...this.source(slots), approvals };
      const evaluation = evaluate(source, blueprint ? blueprintSchema.parse(blueprint.data) : null, request.assessments);
      const bank = await scopedBank(tx, auth, id);
      return tx.qBAuditSnapshot.create({ data: {
        questionBankId: id, version: (latest?.version ?? 0) + 1, status: "DRAFT",
        evaluatorId: auth.user.id, evaluatorName: auth.user.name, remarks: request.remarks,
        score: evaluation.score, decision: evaluation.decision,
        payload: json({ ...evaluation, source, blueprint, sourceHash: sourceHash(source, blueprint), assessments: request.assessments,
          capturedAt: new Date().toISOString(), bankVersion: bank.version,
          evaluator: { id: auth.user.id, name: auth.user.name, email: auth.user.email, designation: "COORDINATOR", departmentId: bank.subject.departmentId, departmentName: (await tx.department.findUnique({ where: { id: bank.subject.departmentId }, select: { name: true } }))?.name },
        }),
      } });
    });
  }

  async finalize(auth: AuthContext, id: string, input: unknown) {
    const { draftId } = finalizeSchema.parse(input);
    return this.write(auth, id, async tx => {
      const draft = await tx.qBAuditSnapshot.findFirst({ where: { id: draftId, questionBankId: id } });
      if (!draft) throw new NotFoundError("Audit draft not found in this bank.");
      if (draft.status !== "DRAFT") throw new ConflictError("Only a draft can be finalized.");
      const existing = await tx.qBAuditSnapshot.findUnique({ where: { finalizedFromId: draftId } });
      if (existing) throw new ConflictError("This draft has already been finalized.");
      const latest = await tx.qBAuditSnapshot.findFirst({ where: { questionBankId: id }, orderBy: { version: "desc" } });
      if (latest?.id !== draftId) throw new ConflictError("This draft is superseded. Save or select the latest draft.");
      const [blueprint, slots, approvals] = await Promise.all([
        tx.qBAuditBlueprint.findFirst({ where: { questionBankId: id }, orderBy: { version: "desc" } }),
        tx.questionSlot.findMany({ where: { questionBankId: id }, include: { assignedQuestion: true } }),
        tx.approvalDecision.findMany({ where: { questionBankId: id } }),
      ]);
      if ((draft.payload as Record<string, unknown>).sourceHash !== sourceHash({ ...this.source(slots), approvals }, blueprint))
        throw new ConflictError("This draft is stale: bank questions, assignments, approval records or blueprint changed. Save a new draft before finalizing.");
      return tx.qBAuditSnapshot.create({ data: {
        questionBankId: id, version: draft.version + 1, status: "FINAL", finalizedFromId: draft.id,
        evaluatorId: auth.user.id, evaluatorName: auth.user.name, remarks: draft.remarks,
        score: draft.score, decision: draft.decision,
        payload: json({ ...(draft.payload as Record<string, unknown>),
          finalizer: { id: auth.user.id, name: auth.user.name, email: auth.user.email, designation: "COORDINATOR", finalizedAt: new Date().toISOString() },
        }),
      } });
    });
  }
}
