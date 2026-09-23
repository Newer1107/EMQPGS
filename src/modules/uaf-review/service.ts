import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, ForbiddenError } from "@/lib/errors";
import type { AuthContext } from "@/lib/types";
import { attributeHasValue, loadReviewSource } from "./source";
import { reviewEvidenceSchema, saveReviewSchema } from "./validation";

export function requireReviewAccess(auth: AuthContext, departmentId: string, now = new Date()) {
  if (!auth?.user?.id || !auth.responsibilities.some(r => r.type === "COORDINATOR" && r.scopeType === "DEPARTMENT" && r.scopeId === departmentId && r.activeFrom <= now && (!r.activeTo || r.activeTo > now))) {
    throw new ForbiddenError("An active coordinator assignment for this bank's department is required.");
  }
}

export class UafReviewService {
  constructor(private readonly db = prisma) {}

  async get(auth: AuthContext, bankId: string) {
    return this.db.$transaction(async tx => {
      const source = await loadReviewSource(tx, bankId);
      requireReviewAccess(auth, source.bank.departmentId);
      const reviews = await tx.uafReview.findMany({ where: { questionBankId: bankId }, orderBy: { version: "desc" }, take: 20,
        include: { reviewer: { select: { name: true } } },
      });
      const latest = reviews[0];
      const evidence = latest ? reviewEvidenceSchema.parse(latest.evidence) : null;
      const staleQuestionIds = evidence?.questions.filter(review => !source.questions.some(q => q.id === review.questionId && q.questionVersion === review.questionVersion)).map(q => q.questionId) ?? [];
      return { ...source, latest: latest ? { id: latest.id, version: latest.version, reviewerId: latest.reviewerId, reviewerName: latest.reviewer.name, createdAt: latest.createdAt.toISOString(), evidence } : null,
        history: reviews.map(review => ({ id: review.id, version: review.version, reviewerName: review.reviewer.name, createdAt: review.createdAt.toISOString() })),
        staleQuestionIds, bankEvidenceCurrent: evidence?.bankFingerprint === source.bankFingerprint,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async save(auth: AuthContext, bankId: string, input: unknown) {
    const request = saveReviewSchema.parse(input);
    return this.db.$transaction(async tx => {
      // Serialize append-only versions, including the first review of a bank.
      await tx.$queryRaw`SELECT id FROM QuestionBank WHERE id = ${bankId} FOR UPDATE`;
      const source = await loadReviewSource(tx, bankId);
      requireReviewAccess(auth, source.bank.departmentId);
      const latest = await tx.uafReview.findFirst({ where: { questionBankId: bankId }, orderBy: { version: "desc" } });
      if ((latest?.version ?? 0) !== request.baseVersion) throw new ConflictError("A newer review was saved. Reload before saving another version.");
      if (request.evidence.bankFingerprint !== source.bankFingerprint) throw new ConflictError("Bank questions or configuration changed. Reload and re-review the current version.");
      for (const review of request.evidence.questions) {
        const question = source.questions.find(q => q.id === review.questionId);
        if (!question) throw new AppError("Review contains a question outside this bank.");
        if (question.questionVersion !== review.questionVersion) throw new ConflictError("A reviewed question changed. Reload and re-review it.");
        for (const attribute of review.attributes) {
          if (!attributeHasValue(question, attribute.attribute)) throw new AppError(`Cannot verify absent ${attribute.attribute} for question ${question.id}. Complete its source metadata first.`);
        }
      }
      const saved = await tx.uafReview.create({ data: {
        questionBankId: bankId, version: request.baseVersion + 1, reviewerId: auth.user.id,
        evidence: JSON.parse(JSON.stringify(request.evidence)) as Prisma.InputJsonValue,
      } });
      return { id: saved.id, version: saved.version, reviewerId: saved.reviewerId, createdAt: saved.createdAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
export type ReviewWorkspace = Awaited<ReturnType<UafReviewService["get"]>>;
