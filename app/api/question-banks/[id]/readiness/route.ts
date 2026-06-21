import { ResponsibilityType, QuestionBankPhase } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ReadinessEngine } from "@/modules/readiness/engine";

import { z } from "zod";

const readinessQuerySchema = z.object({
  targetPhase: z.nativeEnum(QuestionBankPhase),
});

const engine = new ReadinessEngine();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const { targetPhase } = readinessQuerySchema.parse({
      targetPhase: request.nextUrl.searchParams.get("targetPhase"),
    });
    return engine.isReady(questionBankId, targetPhase);
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType, "MODERATOR" as ResponsibilityType] },
);
