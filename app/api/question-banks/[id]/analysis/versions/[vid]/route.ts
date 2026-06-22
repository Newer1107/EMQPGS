import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const GET = withApiHandler(async (request) => {
  const segments = request.nextUrl.pathname.split("/");
  const versionId = segments[segments.length - 1]!;
  const version = await prisma.analysisVersion.findUnique({
    where: { id: versionId },
    include: {
      evidenceSnapshot: true,
      analysisSnapshot: true,
      questionBankAnalysis: {
        include: {
          metrics: { orderBy: { computationOrder: "asc" } },
          risks: { orderBy: { priority: "asc" } },
          recommendations: true,
        },
      },
    },
  });
  return version;
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
