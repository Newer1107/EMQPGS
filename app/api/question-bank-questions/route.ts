import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const GET = withApiHandler(async (request) => {
  const questionBankId = request.nextUrl.searchParams.get("questionBankId");
  if (!questionBankId) return [];
  return prisma.questionBankQuestion.findMany({
    where: { questionBankId },
    include: {
      question: {
        include: {
          subjectVersion: { include: { subject: true } },
          creator: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { linkedAt: "desc" },
  });
}, { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR] });

export const POST = withApiHandler(
  async (request, context) => {
    const { questionId, questionBankId } = await request.json() as { questionId: string; questionBankId: string };
    return prisma.questionBankQuestion.create({
      data: { questionId, questionBankId },
      include: { question: true },
    });
  },
  { roles: [Role.COORDINATOR], successStatus: 201, audit: { action: "QUESTION_LINKED_TO_BANK", entityType: "QUESTION_BANK_QUESTION" } },
);
