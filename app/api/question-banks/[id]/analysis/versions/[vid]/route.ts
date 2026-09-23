import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { requireAnalysisAccess } from "@/lib/uaf/access";
import { UAF_ANALYSIS_FILTER } from "@/lib/uaf/pipeline";

export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const versionId = segments[segments.length - 1]!;
  await requireAnalysisAccess(context.auth!, segments[3]!, [versionId], "uaf");
  const version = await prisma.analysisVersion.findFirst({
    where: { id: versionId, ...UAF_ANALYSIS_FILTER, questionBankAnalysis: { questionBankId: segments[3]!, ...UAF_ANALYSIS_FILTER } },
    include: {
      evidenceSnapshot: true,
      analysisSnapshot: true,
      questionBankAnalysis: {
        include: {
          metrics: { orderBy: { computationOrder: "asc" }, include: { confidence: true } },
          risks: { orderBy: { priority: "asc" } },
          recommendations: true,
        },
      },
    },
  });
  return version;
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
