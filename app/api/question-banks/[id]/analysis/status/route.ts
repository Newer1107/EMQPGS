import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AiOrchestrator } from "@/lib/uaf/ai-orchestrator";

const orchestrator = new AiOrchestrator();

export const GET = withApiHandler(async (request) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  return orchestrator.getStatus(bankId);
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
