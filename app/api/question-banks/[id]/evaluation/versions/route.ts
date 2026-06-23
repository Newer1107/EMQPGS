import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { EvaluationOrchestrator } from "@/lib/evaluation/evaluation-orchestrator";

const orchestrator = new EvaluationOrchestrator();

// GET /api/question-banks/[id]/evaluation/versions — List all evaluation versions
export const GET = withApiHandler(async (request) => {
  const segments = request.nextUrl.pathname.split("/");
  const bankId = segments[3]!;
  const versions = await orchestrator.listVersions(bankId);
  return versions;
}, { responsibility: ["COORDINATOR" as ResponsibilityType] });
