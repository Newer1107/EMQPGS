import { Role } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { NotificationService } from "@/modules/notifications/service";

const notificationService = new NotificationService();
const assignmentSchema = z.object({
  moderatorId: z.string().min(1),
});

export const POST = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const payload = assignmentSchema.parse(await parseJson(request));

    const moderator = await prisma.user.findUnique({
      where: { id: payload.moderatorId },
      select: { id: true, role: true, name: true, email: true },
    });
    if (!moderator) throw new NotFoundError("User not found");
    if (moderator.role !== Role.MODERATOR) {
      throw new AppError("Only users with the MODERATOR role can be assigned.", 400);
    }

    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: { select: { subjectName: true } } },
    });
    if (!bank) throw new NotFoundError("Question bank not found");

    const existing = await prisma.moderatorBankAssignment.findUnique({
      where: { moderatorId_questionBankId: { moderatorId: payload.moderatorId, questionBankId } },
    });
    if (existing) {
      throw new AppError("Moderator is already assigned to this question bank.", 409);
    }

    const assignment = await prisma.moderatorBankAssignment.create({
      data: { moderatorId: payload.moderatorId, questionBankId },
    });

    await notificationService.create(
      moderator.id,
      "New moderation assignment",
      `You have been assigned to moderate the question bank for ${bank.subject.subjectName}.`,
      "/dashboard/moderator/questions",
      "ACTION_REQUIRED",
    );

    return assignment;
  },
  {
    roles: [Role.COORDINATOR],
    successStatus: 201,
    audit: {
      action: "MODERATOR_ASSIGNED",
      entityType: "QUESTION_BANK",
      getEntityId: () => null,
      getMetadata: (request) => ({ questionBankId: request.nextUrl.pathname.split("/").slice(-3)[0]!, moderatorId: undefined }),
    },
  },
);
