import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { z } from "zod";

const markUsedSchema = z.object({
  examDate: z.string().optional(),
  examCycleId: z.string().optional(),
});

export const POST = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const body = markUsedSchema.parse(await request.json());

    const paper = await prisma.generatedPaper.findUnique({
      where: { id },
      include: {
        items: { include: { question: true } },
        questionBank: {
          include: {
            subject: true,
            batchSemester: { include: { academicYear: true } },
          },
        },
      },
    });

    if (!paper) throw new AppError("Paper not found", 404);
    if (paper.status !== "COMPLETED") throw new AppError("Paper is not in COMPLETED status", 400);

    const created = await prisma.questionUsageHistory.createMany({
      data: paper.items.map((item) => ({
        questionId: item.questionId,
        sourceType: "USED_IN_EXAM",
        sourceId: paper.id,
        examCycleId: body.examCycleId ?? null,
        usedAt: body.examDate ? new Date(body.examDate) : new Date(),
      })),
      skipDuplicates: true,
    });

    return { paperId: paper.id, variant: paper.variant, questionsMarked: created.count };
  },
  { responsibility: ["COE" as ResponsibilityType] },
);
