import { NotificationType, Prisma, QuestionBankStatus, QuestionStatus, Role, type User } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { AppError, ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { canEditQuestion, canModerateQuestion, canViewQuestion } from "@/modules/questions/permissions";
import { QuestionRepository } from "@/modules/questions/repository";
import { buildQuestionSlotTemplate } from "@/modules/questions/slot-template";
import { ENTITY_TYPES } from "@/lib/constants";
import type { QuestionInput } from "@/modules/questions/validation";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class QuestionService {
  constructor(
    private readonly repository = new QuestionRepository(),
    private readonly notificationService = new NotificationService(),
    private readonly storageService = new StorageService(),
  ) {}

  async ensureSlotGrid(questionBankId: string) {
    const questionBank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!questionBank) throw new NotFoundError("Question bank not found");

    const template = buildQuestionSlotTemplate();
    await prisma.questionSlot.createMany({
      data: template.map((slot) => ({ questionBankId, ...slot })),
      skipDuplicates: true,
    });

    return this.repository.listSlots(questionBankId);
  }

  async listSlots(questionBankId: string) {
    await this.ensureSlotGrid(questionBankId);
    return this.repository.listSlots(questionBankId);
  }

  async listQuestions(questionBankId: string, actor: Actor) {
    if (actor.role === Role.MODERATOR) {
      const assignment = await prisma.moderatorBankAssignment.findUnique({
        where: {
          moderatorId_questionBankId: {
            moderatorId: actor.id,
            questionBankId,
          },
        },
      });
      if (!assignment) {
        throw new ForbiddenError("You do not have access to this question bank");
      }
    }
    return this.repository.listForQuestionBank(questionBankId, actor);
  }

  async reserveSlot(input: { questionBankId: string; moduleNumber: number; marks: number; slotNumber: number }, actor: Actor, moderatorOverride = false) {
    const questionBank = await prisma.questionBank.findUnique({
      where: { id: input.questionBankId },
      include: { assignments: true },
    });
    if (!questionBank) throw new NotFoundError("Question bank not found");
    this.ensureQuestionBankMutable(questionBank.status);

    const isModerator = actor.role === Role.MODERATOR;
    const isContributor = actor.role === Role.CONTRIBUTOR;

    if (!isModerator && !isContributor) {
      throw new ForbiddenError("Only contributors and moderators can reserve slots");
    }

    const isAssignedContributor = questionBank.assignments.some(
      (assignment) =>
        assignment.teacherId === actor.id &&
        assignment.assignmentRole === "CONTRIBUTOR" &&
        assignment.moduleNumber === input.moduleNumber,
    );
    const isAssignedModerator = questionBank.assignments.some((assignment) => assignment.teacherId === actor.id && assignment.assignmentRole === "MODERATOR");

    if (isContributor && !isAssignedContributor) {
      throw new ForbiddenError("Contributor is not assigned to this question bank");
    }

    if (isModerator && !isAssignedModerator && !moderatorOverride) {
      throw new ForbiddenError("Moderator is not assigned to this question bank");
    }

    const result = await this.repository.reserveSlot(
      input.questionBankId,
      input.moduleNumber,
      input.marks,
      input.slotNumber,
      actor.id,
      moderatorOverride || isModerator,
    );

    if (!result) throw new NotFoundError("Slot not found");
    if ("collision" in result && result.collision === "SLOT_TAKEN") throw new AppError("Slot already reserved", 409);
    if ("collision" in result && result.collision === "QUESTION_EXISTS") throw new AppError("Question already exists for this slot", 409);

    return result.slot;
  }

  async createQuestion(input: QuestionInput, actor: Actor) {
    const slot = await this.repository.findSlotById(input.slotId);
    if (!slot) throw new NotFoundError("Reserved slot not found");
    this.ensureQuestionBankMutable(slot.questionBank.status);
    if (!slot.reservedById) throw new AppError("Slot must be reserved before creating a question", 400);
    if (slot.reservedById !== actor.id && actor.role !== Role.MODERATOR) throw new ForbiddenError("You do not own this slot");
    if (slot.question) throw new AppError("A question already exists for this slot", 409);

    const question = await this.repository.createQuestion({
      ...input,
      questionBankId: slot.questionBankId,
      moduleNumber: slot.moduleNumber,
      marks: slot.marks,
      slotNumber: slot.slotNumber,
      contributorId: actor.role === Role.MODERATOR && slot.reservedById ? slot.reservedById : actor.id,
    });

    await logAudit({
      actorId: actor.id,
      action: "QUESTION_CREATED",
      entityType: ENTITY_TYPES.QUESTION,
      entityId: question.id,
      metadata: { slotId: slot.id, moduleNumber: slot.moduleNumber, marks: slot.marks, slotNumber: slot.slotNumber },
    });

    return question;
  }

  async updateQuestion(id: string, input: Partial<QuestionInput>, actor: Actor) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    this.ensureQuestionBankMutable(question.questionBank.status);
    if (!canEditQuestion(actor, question)) throw new ForbiddenError("You cannot edit this question");

    try {
      const updated = await this.repository.updateQuestion(
        id,
        {
          ...normalizeQuestionUpdate(input),
          ...(actor.role === Role.CONTRIBUTOR
            ? {
                status: question.status === QuestionStatus.REVISION_REQUESTED ? QuestionStatus.REVISION_REQUESTED : QuestionStatus.DRAFT,
              }
            : {}),
        },
        question.version,
      );

      await logAudit({
        actorId: actor.id,
        action: "QUESTION_EDITED",
        entityType: ENTITY_TYPES.QUESTION,
        entityId: updated.id,
        metadata: { fields: Object.keys(input) },
      });

      return updated;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new ConflictError("Question was modified by another request. Refresh and try again.");
      }
      throw err;
    }
  }

  async submitQuestion(id: string, actor: Actor) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    this.ensureQuestionBankMutable(question.questionBank.status);
    if (question.contributorId !== actor.id) throw new ForbiddenError("Only the contributor can submit this question");
    if (question.questionText.trim().length < 15) throw new AppError("Question text must be at least 15 characters", 400);
    if (question.status !== QuestionStatus.DRAFT && question.status !== QuestionStatus.REVISION_REQUESTED) {
      throw new AppError("Question cannot be submitted in its current status.", 409);
    }

    const nextStatus =
      question.status === QuestionStatus.REVISION_REQUESTED ? QuestionStatus.REVISION_SUBMITTED : QuestionStatus.PENDING;

    const currentVersion = question.version;

    let updated: Awaited<ReturnType<typeof this.repository.findById>>;
    try {
      updated = await prisma.$transaction(async (tx) => {
      const revisionCount = await tx.questionRevision.count({
        where: { questionId: id },
      });

      const result = await tx.question.update({
        where: { id, version: currentVersion },
        data: {
          status: nextStatus,
          submittedAt: new Date(),
          version: { increment: 1 },
        },
        include: {
          contributor: true,
          attachments: {
            include: {
              fileAsset: true,
            },
          },
          slot: true,
          questionBank: {
            include: {
              subject: true,
              examCycle: true,
              assignments: { include: { teacher: true } },
            },
          },
        },
      });

      await tx.questionRevision.create({
        data: {
          questionId: id,
          versionNumber: revisionCount + 1,
          questionText: result.questionText,
          submittedById: actor.id,
          submittedAt: result.submittedAt ?? new Date(),
          moderatorComment: question.moderatorRemark ?? null,
        },
      });

      return result;
    });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new ConflictError("Question was modified by another request. Refresh and try again.");
      }
      throw err;
    }

    const moderatorAssignments = await prisma.moderatorBankAssignment.findMany({
      where: {
        questionBankId: updated.questionBankId,
      },
      include: {
        moderator: true,
      },
    });
    const coordinatorRecipients = await prisma.coordinatorDepartmentAssignment.findMany({
      where: {
        departmentId: updated.questionBank.subject.departmentId,
      },
      include: {
        coordinator: true,
      },
    });

    for (const assignment of moderatorAssignments) {
      await this.notificationService.createAndEmail(
        assignment.moderator,
        nextStatus === QuestionStatus.REVISION_SUBMITTED ? `Revision resubmitted for ${updated.questionBank.subject.subjectCode}` : `Question submitted for ${updated.questionBank.subject.subjectCode}`,
        nextStatus === QuestionStatus.REVISION_SUBMITTED
          ? `${updated.contributor.name} has resubmitted a revised question in ${updated.questionBank.subject.subjectName} - Module ${updated.moduleNumber}.`
          : `A new question has been submitted by ${updated.contributor.name} in ${updated.questionBank.subject.subjectName} - Module ${updated.moduleNumber}.`,
        "/dashboard/moderator/questions",
        NotificationType.ACTION_REQUIRED,
      );
    }

    await Promise.all(
      coordinatorRecipients.map(({ coordinator }) =>
        this.notificationService.create(
          coordinator.id,
          "Question submitted",
          `A new question has been submitted by ${updated.contributor.name} in ${updated.questionBank.subject.subjectName} - Module ${updated.moduleNumber}.`,
          `/dashboard/coordinator/questions?questionId=${updated.id}`,
          NotificationType.INFO,
        ),
      ),
    );

    return updated;
  }

  async moderateQuestion(id: string, actor: Actor, action: "APPROVE" | "REJECT" | "REQUEST_REVISION", remark?: string) {
    if (!canModerateQuestion(actor)) throw new ForbiddenError("Only moderators can moderate questions");
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    this.ensureQuestionBankMutable(question.questionBank.status);

    const targetStatus =
      action === "APPROVE"
        ? QuestionStatus.APPROVED
        : action === "REJECT"
          ? QuestionStatus.REJECTED
          : QuestionStatus.REVISION_REQUESTED;

    let updated: Awaited<ReturnType<typeof this.repository.findById>>;
    try {
      updated = await this.repository.updateQuestion(
        id,
        {
          status: targetStatus,
          reviewedAt: new Date(),
          moderatorRemark: remark ?? null,
        },
        question.version,
      );
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new ConflictError("Question was modified by another request. Refresh and try again.");
      }
      throw err;
    }

    const titleByAction = {
      APPROVE: "Question approved",
      REJECT: "Question rejected",
      REQUEST_REVISION: "Revision requested",
    } as const;

    const bodyByAction = {
      APPROVE: `Your question for Module ${updated.moduleNumber}, ${updated.marks}-mark Slot ${updated.slotNumber} was approved.`,
      REJECT: `Your question for Module ${updated.moduleNumber}, ${updated.marks}-mark Slot ${updated.slotNumber} was rejected.`,
      REQUEST_REVISION: `Your question for Module ${updated.moduleNumber}, ${updated.marks}-mark Slot ${updated.slotNumber} needs revision.`,
    } as const;

    const contributor = await prisma.user.findUnique({ where: { id: updated.contributorId } });
    const coordinatorRecipients = await prisma.coordinatorDepartmentAssignment.findMany({
      where: {
        departmentId: updated.questionBank.subject.departmentId,
      },
      include: {
        coordinator: true,
      },
    });

    if (contributor) {
      await this.notificationService.createAndEmail(
        contributor,
        titleByAction[action],
        `${bodyByAction[action]}${remark ? ` Remark: ${remark}` : ""}`,
        "/dashboard/contributor/questions",
        action === "APPROVE" ? NotificationType.SUCCESS : NotificationType.ACTION_REQUIRED,
      );
    }

    await Promise.all(
      coordinatorRecipients.map(({ coordinator }) =>
        this.notificationService.create(
          coordinator.id,
          "Moderation action",
          `Question in ${updated.questionBank.subject.subjectName} Module ${updated.moduleNumber} has been ${targetStatus.toLowerCase().replaceAll("_", " ")} by ${actor.name}.`,
          `/dashboard/coordinator/questions?questionId=${updated.id}`,
          targetStatus === QuestionStatus.APPROVED ? NotificationType.SUCCESS : NotificationType.ACTION_REQUIRED,
        ),
      ),
    );

    await logAudit({
      actorId: actor.id,
      action: action === "APPROVE" ? "QUESTION_APPROVED" : action === "REJECT" ? "QUESTION_REJECTED" : "QUESTION_REVISION_REQUESTED",
      entityType: ENTITY_TYPES.QUESTION,
      entityId: updated.id,
      metadata: { remark },
    });

    return updated;
  }

  async getQuestion(id: string, actor: Actor) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    if (actor.role === Role.MODERATOR) {
      const assignment = await prisma.moderatorBankAssignment.findUnique({
        where: {
          moderatorId_questionBankId: {
            moderatorId: actor.id,
            questionBankId: question.questionBankId,
          },
        },
      });
      if (!assignment) {
        throw new ForbiddenError("You cannot view this question");
      }
    }
    if (!canViewQuestion(actor, question)) throw new ForbiddenError("You cannot view this question");
    return question;
  }

  async addAttachment(questionId: string, fileAssetId: string, actor: Actor) {
    const question = await this.repository.findById(questionId);
    if (!question) throw new NotFoundError("Question not found");
    this.ensureQuestionBankMutable(question.questionBank.status);
    if (!canEditQuestion(actor, question)) throw new ForbiddenError("You cannot modify attachments on this question");

    return this.repository.attachFile(questionId, fileAssetId, actor.id);
  }

  async listAttachments(questionId: string, actor: Actor) {
    const question = await this.repository.findById(questionId);
    if (!question) throw new NotFoundError("Question not found");
    if (!canViewQuestion(actor, question)) throw new ForbiddenError("You cannot view these attachments");
    return this.repository.listAttachments(questionId);
  }

  async replaceAttachment(attachmentId: string, fileAssetId: string, actor: Actor) {
    const attachment = await this.repository.findAttachment(attachmentId);
    if (!attachment) throw new NotFoundError("Attachment not found");
    const question = await this.repository.findById(attachment.questionId);
    if (!question) throw new NotFoundError("Question not found");
    this.ensureQuestionBankMutable(question.questionBank.status);
    if (!canEditQuestion(actor, question)) throw new ForbiddenError("You cannot replace this attachment");
    return this.repository.replaceAttachment(attachmentId, fileAssetId);
  }

  async deleteAttachment(attachmentId: string, actor: Actor) {
    const attachment = await this.repository.findAttachment(attachmentId);
    if (!attachment) throw new NotFoundError("Attachment not found");
    const question = await this.repository.findById(attachment.questionId);
    if (!question) throw new NotFoundError("Question not found");
    this.ensureQuestionBankMutable(question.questionBank.status);
    if (!canEditQuestion(actor, question)) throw new ForbiddenError("You cannot delete this attachment");
    return this.repository.deleteAttachment(attachmentId);
  }

  async createAttachmentUploadUrl(questionId: string, actor: Actor, fileName: string, mimeType: string, size: number) {
    const question = await this.repository.findById(questionId);
    if (!question) throw new NotFoundError("Question not found");
    this.ensureQuestionBankMutable(question.questionBank.status);
    if (!canEditQuestion(actor, question)) throw new ForbiddenError("You cannot upload attachments for this question");

    return this.storageService.createUploadLink({
      bucket: "question-bank-attachments",
      fileName,
      mimeType,
      size,
      uploadedById: actor.id,
      linkedEntityType: ENTITY_TYPES.QUESTION,
      linkedEntityId: questionId,
    });
  }

  private ensureQuestionBankMutable(status: QuestionBankStatus) {
    if (status === QuestionBankStatus.LOCKED) {
      throw new AppError("Locked question bank cannot be modified", 409);
    }
  }
}

function normalizeQuestionUpdate(input: Partial<QuestionInput>): Prisma.QuestionUpdateInput {
  return {
    ...(input.questionText !== undefined ? { questionText: input.questionText } : {}),
    ...(input.coMapping !== undefined ? { coMapping: input.coMapping } : {}),
    ...(input.rbtLevel !== undefined ? { rbtLevel: input.rbtLevel } : {}),
    ...(input.teachingIndex !== undefined ? { teachingIndex: input.teachingIndex ?? null } : {}),
    ...(input.difficultyLevel !== undefined ? { difficultyLevel: input.difficultyLevel ?? null } : {}),
  };
}
