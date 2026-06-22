import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AiOrchestrator } from "@/lib/uaf/ai-orchestrator";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api-context";

const orchestrator = new AiOrchestrator();

export const POST = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  const userId = context.user!.id;
  const meta = await getRequestMeta();
  const result = await orchestrator.analyze(bankId, userId, { forceRegenerate: true });
  await logAudit({ actorId: userId, action: "ANALYSIS_REGENERATED", entityType: "QUESTION_BANK", entityId: bankId, ...meta });
  return { status: "regeneration_complete", result };
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
