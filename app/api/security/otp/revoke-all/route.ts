import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { getEmergencyService } from "@/lib/auth/emergency-service";

export const POST = withApiHandler(
  async (_request, { user }) => {
    const emergency = getEmergencyService();
    const count = await emergency.revokeOtps(user!.id);
    return { revoked: count };
  },
  {
    responsibility: ["COE" as ResponsibilityType],
    audit: {
      action: "OTPS_REVOKED",
      entityType: "OTP_CODE",
      getMetadata: (_req, result) => ({ count: (result as any).revoked }),
    },
  },
);
