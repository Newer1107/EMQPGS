import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { StorageService } from "@/lib/storage/storage-service";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const storageService = new StorageService();

export const GET = withApiHandler(async (request, context) => {
  const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
  const attachment = await prisma.questionAttachment.findUnique({
    where: { id },
    include: { question: true },
  });

  if (!attachment) throw new NotFoundError("Attachment not found");

  if (context.user!.role === Role.CONTRIBUTOR && attachment.question.contributorId !== context.user!.id) {
    throw new ForbiddenError("You cannot access this attachment");
  }
  if (context.user!.role === Role.MODERATOR) {
    const assignment = await prisma.moderatorBankAssignment.findFirst({
      where: {
        moderatorId: context.user!.id,
        questionBankId: attachment.question.questionBankId,
      },
    });
    if (!assignment) {
      throw new ForbiddenError("You cannot access this attachment");
    }
  }

  return storageService.createDownloadLink(attachment.fileAssetId);
}, { roles: [Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.COE] });
