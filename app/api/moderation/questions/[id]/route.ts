import { Role, QuestionStatus } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export const GET = withApiHandler(
  async (_request, context) => {
    const id = _request.nextUrl.pathname.split("/").pop()!;
    const question = await prisma.questionLibraryItem.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        subjectVersion: { include: { subject: true, effectiveFromAcademicYear: true } },
        slotAssignments: { include: { questionBank: { select: { id: true, examCycle: { select: { examType: true } } } } } },
        moderationEvents: {
          orderBy: { createdAt: "asc" },
          include: { moderator: { select: { id: true, name: true } } },
        },
      },
    });
    if (!question) throw new NotFoundError("Question not found");
    return question;
  },
  { roles: [Role.MODERATOR] },
);
