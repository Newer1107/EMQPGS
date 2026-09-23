import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { requireAnalysisAccess } from "@/lib/uaf/access";

export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  await requireAnalysisAccess(context.auth!, bankId);
  const versions = await prisma.analysisVersion.findMany({
    where: { questionBankAnalysis: { questionBankId: bankId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      versionNumber: true,
      evaluationEngineVersion: true,
      evidenceHash: true,
      createdAt: true,
    },
  });
  return versions;
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
