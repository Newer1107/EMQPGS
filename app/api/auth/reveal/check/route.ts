import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { getRevealSessionManager } from "@/lib/auth/reveal-session";

const querySchema = z.object({
  paperId: z.string().min(1, "paperId is required"),
});

export const GET = withApiHandler(
  async (request: NextRequest, { user }) => {
    const params = querySchema.parse({
      paperId: request.nextUrl.searchParams.get("paperId"),
    });

    const manager = getRevealSessionManager();
    const valid = manager.isRevealValid(user!.id, params.paperId);
    const remaining = manager.getRemainingSeconds(user!.id, params.paperId);

    return { valid, remainingSeconds: remaining };
  },
  {
    responsibility: [ResponsibilityType.DEAN, ResponsibilityType.COE],
  },
);
