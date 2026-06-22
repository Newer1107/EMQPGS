import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AiOrchestrator } from "@/lib/uaf/ai-orchestrator";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api-context";

const orchestrator = new AiOrchestrator();

export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[4]!;
  const analysis = await orchestrator.getStatus(bankId);
  return analysis ?? { notFound: true };
}, { responsibility: ["DEAN" as ResponsibilityType] });

export const POST = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[4]!;
  const userId = context.user!.id;
  const meta = await getRequestMeta();
  const result = await orchestrator.analyze(bankId, userId);
  await logAudit({ actorId: userId, action: "ANALYSIS_REQUESTED", entityType: "QUESTION_BANK", entityId: bankId, ...meta });
  return result;
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
