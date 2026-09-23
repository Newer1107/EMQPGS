import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AiOrchestrator } from "@/lib/uaf/ai-orchestrator";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api-context";
import { requireAnalysisAccess } from "@/lib/uaf/access";

const orchestrator = new AiOrchestrator();

export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  await requireAnalysisAccess(context.auth!, bankId);
  const analysis = await orchestrator.getStatus(bankId);
  return analysis ?? { notFound: true };
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });

export const POST = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  const userId = context.user!.id;
  await requireAnalysisAccess(context.auth!, bankId);
  const meta = await getRequestMeta();
  const result = await orchestrator.analyze(bankId, userId);
  await logAudit({ actorId: userId, action: "ANALYSIS_REQUESTED", entityType: "QUESTION_BANK", entityId: bankId, ...meta });
  return result;
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
