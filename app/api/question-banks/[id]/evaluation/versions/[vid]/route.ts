import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { EvaluationOrchestrator } from "@/lib/evaluation/evaluation-orchestrator";
import { requireAnalysisAccess } from "@/lib/uaf/access";

const orchestrator = new EvaluationOrchestrator();

// GET /api/question-banks/[id]/evaluation/versions/[vid] — Get specific evaluation version
export const GET = withApiHandler(async (request, context) => {
  const segments = request.nextUrl.pathname.split("/");
  const vid = segments[6]!; // .../evaluation/versions/[vid]
  await requireAnalysisAccess(context.auth!, segments[3]!, [vid]);
  const version = await orchestrator.getVersion(vid);
  return version ?? { notFound: true };
}, { responsibility: ["COORDINATOR" as ResponsibilityType] });
