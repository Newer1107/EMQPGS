import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const GET = withApiHandler(async (request) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  const latestAnalysis = await prisma.questionBankAnalysis.findFirst({
    where: { questionBankId: bankId, status: "COMPLETE" },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (!latestAnalysis) return { papers: [] };
  const papers = await prisma.paperAnalysis.findMany({
    where: { questionBankAnalysisId: latestAnalysis.id },
    include: {
      generatedPaper: { select: { variant: true, coverageScore: true, qualityScore: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return { papers };
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
