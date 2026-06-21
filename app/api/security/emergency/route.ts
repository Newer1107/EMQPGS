import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { EmergencyApprovalService } from "@/lib/auth/emergency-approval";

const createSchema = z.object({
  action: z.string().min(1),
  reason: z.string().min(1),
});

const patchSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().optional(),
});

const service = new EmergencyApprovalService();

export const GET = withApiHandler(async () => {
  const pending = await service.getPending();
  return { approvals: pending };
}, { responsibility: [ResponsibilityType.COE] });

export const POST = withApiHandler(
  async (request: NextRequest, { user }) => {
    const body = createSchema.parse(await request.json());
    const approval = await service.request(body.action, body.reason, user!.id);
    return { approval };
  },
  { responsibility: [ResponsibilityType.COE] },
);

export const PATCH = withApiHandler(
  async (request: NextRequest, { user }) => {
    const body = patchSchema.parse(await request.json());

    if (body.decision === "APPROVE") {
      const approval = await service.approve(body.approvalId, user!.id);
      return { approval, action: "APPROVED" };
    } else {
      const approval = await service.reject(body.approvalId, user!.id, body.reason);
      return { approval, action: "REJECTED" };
    }
  },
  { responsibility: [ResponsibilityType.COE] },
);
