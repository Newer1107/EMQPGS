import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AiOrchestrator } from "@/lib/uaf/ai-orchestrator";
import { requireAnalysisAccess } from "@/lib/uaf/access";

const orchestrator = new AiOrchestrator();

export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  await requireAnalysisAccess(context.auth!, bankId);
  return orchestrator.getStatus(bankId);
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
