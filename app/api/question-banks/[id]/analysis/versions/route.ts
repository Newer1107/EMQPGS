import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const GET = withApiHandler(async (request) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[4]!;
  const versions = await prisma.analysisVersion.findMany({
    where: { questionBankAnalysis: { questionBankId: bankId } },
    orderBy: { versionNumber: "desc" },
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
