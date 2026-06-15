import { NotificationType, QuestionBankStatus, type User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { ENTITY_TYPES } from "@/lib/constants";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class SignedReportService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly notificationService = new NotificationService(),
  ) {}

  async uploadSignedReport(questionBankId: string, fileAssetId: string, actor: Actor) {
    const questionBank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { moderatorAssignments: { where: { moderatorId: actor.id } }, subject: true },
    });
    if (!questionBank) throw new NotFoundError("Question bank not found");
    const isModerator = questionBank.moderatorAssignments.length > 0 || actor.role === "MODERATOR";
    if (!isModerator) throw new ForbiddenError("Only the assigned moderator can upload the signed report");

    const updated = await prisma.questionBank.update({
      where: { id: questionBankId },
      data: {
        signedReportAssetId: fileAssetId,
        signedReportUploadedAt: new Date(),
        status: QuestionBankStatus.SIGNED_REPORT_UPLOADED,
      },
      include: {
        signedReportAsset: true,
      },
    });

    const coordinators = await prisma.coordinatorDepartmentAssignment.findMany({
      where: { departmentId: questionBank.subject.departmentId },
      include: { coordinator: true },
    });
    await Promise.all(
      coordinators.map(({ coordinator }) =>
        this.notificationService.createAndEmail(
          coordinator,
          "Signed HOD report uploaded",
          `A signed report is ready for coordinator review for ${updated.id}.`,
          "/dashboard/coordinator/questions",
          NotificationType.ACTION_REQUIRED,
        ),
      ),
    );

    return updated;
  }

  async createSignedReportUploadUrl(questionBankId: string, actor: Actor, fileName: string, mimeType: string, size: number) {
    const questionBank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!questionBank) throw new NotFoundError("Question bank not found");

    return this.storageService.createUploadLink({
      bucket: "signed-reports",
      fileName,
      mimeType,
      size,
      uploadedById: actor.id,
      linkedEntityType: ENTITY_TYPES.QUESTION_BANK_SIGNED_REPORT,
      linkedEntityId: questionBankId,
    });
  }
}
