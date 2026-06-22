import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const GET = withApiHandler(async (request) => {
  const segments = request.nextUrl.pathname.split("/");
  const paperId = segments[segments.length - 1]!;
  const paper = await prisma.paperAnalysis.findUnique({
    where: { id: paperId },
    include: {
      generatedPaper: { select: { variant: true, coverageScore: true, difficultyScore: true, qualityScore: true } },
    },
  });
  return paper;
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
