import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { EvaluationOrchestrator } from "@/lib/evaluation/evaluation-orchestrator";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api-context";

const orchestrator = new EvaluationOrchestrator();

// POST /api/question-banks/[id]/evaluation/regenerate — Force-regenerate evaluation
export const POST = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  const userId = context.user!.id;
  const meta = await getRequestMeta();

  const result = await orchestrator.evaluate(bankId, userId, { forceRegenerate: true });

  await logAudit({
    actorId: userId,
    action: "EVALUATION_REGENERATED",
    entityType: "QUESTION_BANK",
    entityId: bankId,
    metadata: { analysisId: result.analysisId, versionId: result.versionId },
    ...meta,
  });

  return result;
}, { responsibility: ["COORDINATOR" as ResponsibilityType] });
