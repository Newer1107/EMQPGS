import { QuestionStatus } from "@prisma/client";
import { BaseRepository } from "@/modules/shared/base-repository";
import type { QuestionLibraryItemInput } from "@/modules/question-library/validation";

const listInclude = {
  subjectVersion: { include: { subject: true, effectiveFromAcademicYear: true } },
  creator: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, email: true } },
  slotAssignments: { include: { questionBank: { select: { id: true, examCycle: { select: { examType: true } } } } } },
} as const;

export class QuestionLibraryRepository extends BaseRepository {
  findById(id: string) {
    return this.prisma.questionLibraryItem.findUnique({
      where: { id },
      include: {
        ...listInclude,
        moderationEvents: { include: { moderator: { select: { id: true, name: true } } } },
        generatedPaperItems: { include: { generatedPaper: { select: { id: true, variant: true } } } },
        ownershipHistory: { include: { fromUser: { select: { id: true, name: true } }, toUser: { select: { id: true, name: true } }, transferredBy: { select: { id: true, name: true } } } },
        revisionHistory: { include: { changedBy: { select: { id: true, name: true } } } },
        usageHistory: true,
      },
    });
  }

  findBySubjectVersion(subjectVersionId: string) {
    return this.prisma.questionLibraryItem.findMany({
      where: { subjectVersionId },
      orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { createdAt: "desc" }],
      include: listInclude,
    });
  }

  findByBank(questionBankId: string) {
    return this.prisma.questionLibraryItem.findMany({
      where: { slotAssignments: { some: { questionBankId } } },
      orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { createdAt: "desc" }],
      include: listInclude,
    });
  }

  search(query: string, subjectVersionId?: string) {
    return this.prisma.questionLibraryItem.findMany({
      where: { questionText: { contains: query }, ...(subjectVersionId ? { subjectVersionId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: listInclude,
    });
  }

  create(data: QuestionLibraryItemInput & { createdById: string; ownerId: string }) {
    return this.prisma.questionLibraryItem.create({ data, include: listInclude });
  }

  update(id: string, data: Partial<QuestionLibraryItemInput>) {
    return this.prisma.questionLibraryItem.update({ where: { id }, data, include: listInclude });
  }

  updateStatus(id: string, status: QuestionStatus, submittedAt: Date) {
    return this.prisma.questionLibraryItem.update({
      where: { id },
      data: { status, submittedAt },
      include: listInclude,
    });
  }

  updateOwner(id: string, ownerId: string) {
    return this.prisma.questionLibraryItem.update({
      where: { id },
      data: { ownerId },
      include: listInclude,
    });
  }
}
