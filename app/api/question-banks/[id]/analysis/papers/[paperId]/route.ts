import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { requireAnalysisAccess } from "@/lib/uaf/access";

export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const paperId = segments[segments.length - 1]!;
  await requireAnalysisAccess(context.auth!, segments[3]!);
  const paper = await prisma.paperAnalysis.findFirst({
    where: { id: paperId, questionBankAnalysis: { questionBankId: segments[3]! } },
    include: {
      generatedPaper: { select: { variant: true, coverageScore: true, difficultyScore: true, qualityScore: true } },
    },
  });
  return paper;
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
