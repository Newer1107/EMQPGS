import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { getRevealSessionManager } from "@/lib/auth/reveal-session";

const bodySchema = z.object({
  paperIds: z.array(z.string().min(1)).min(1, "At least one paper ID is required"),
});

export const POST = withApiHandler(
  async (request: NextRequest, { user }) => {
    const body = bodySchema.parse(await request.json());
    const manager = getRevealSessionManager();

    manager.startReveal(user!.id, body.paperIds);

    // Calculate the expiration time from the first paper's session
    const remaining = manager.getRemainingSeconds(user!.id, body.paperIds[0]);

    return {
      expiresInMs: remaining * 1000,
      paperIds: body.paperIds,
    };
  },
  {
    responsibility: [ResponsibilityType.DEAN, ResponsibilityType.COE],
  },
);
