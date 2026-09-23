import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { requireAnalysisAccess } from "@/lib/uaf/access";
import { UAF_ANALYSIS_FILTER } from "@/lib/uaf/pipeline";

export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  await requireAnalysisAccess(context.auth!, bankId);
  const latestAnalysis = await prisma.questionBankAnalysis.findFirst({
    where: { questionBankId: bankId, status: "COMPLETE", ...UAF_ANALYSIS_FILTER },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (!latestAnalysis) return { papers: [] };
  const papers = await prisma.paperAnalysis.findMany({
    where: { questionBankAnalysisId: latestAnalysis.id, questionBankAnalysis: { questionBankId: bankId, ...UAF_ANALYSIS_FILTER } },
    include: {
      generatedPaper: { select: { variant: true, coverageScore: true, qualityScore: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return { papers };
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
