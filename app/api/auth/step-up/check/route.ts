import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { StepUpService } from "@/lib/auth/step-up-service";

const querySchema = z.object({
  action: z.string().min(1, "action is required"),
  resourceId: z.string().optional(),
});

export const GET = withApiHandler(
  async (request: NextRequest, { user }) => {
    const params = querySchema.parse({
      action: request.nextUrl.searchParams.get("action"),
      resourceId: request.nextUrl.searchParams.get("resourceId"),
    });

    const stepUpService = new StepUpService();
    const verified = stepUpService.isVerified(user!.id, params.action, params.resourceId);

    return { verified };
  },
  {
    responsibility: [ResponsibilityType.DEAN, ResponsibilityType.COE],
  },
);
