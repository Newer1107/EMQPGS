import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { EvaluationOrchestrator } from "@/lib/evaluation/evaluation-orchestrator";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api-context";
import { requireAnalysisAccess } from "@/lib/uaf/access";

const orchestrator = new EvaluationOrchestrator();

// GET /api/question-banks/[id]/evaluation — Get latest evaluation
export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  await requireAnalysisAccess(context.auth!, bankId);
  const evaluation = await orchestrator.getLatest(bankId);
  return evaluation ?? { notFound: true };
}, { responsibility: ["COORDINATOR" as ResponsibilityType] });

// POST /api/question-banks/[id]/evaluation — Trigger evaluation
export const POST = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  const userId = context.user!.id;
  await requireAnalysisAccess(context.auth!, bankId);
  const meta = await getRequestMeta();

  const result = await orchestrator.evaluate(bankId, userId);

  await logAudit({
    actorId: userId,
    action: "EVALUATION_REQUESTED",
    entityType: "QUESTION_BANK",
    entityId: bankId,
    metadata: { analysisId: result.analysisId, versionId: result.versionId },
    ...meta,
  });

  return result;
}, { responsibility: ["COORDINATOR" as ResponsibilityType] });
