import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { SecurityConfig, getSecurityModeLabel } from "@/lib/auth/security-config";

const patchSchema = z.object({
  key: z.string().min(1, "key is required"),
  value: z.string().min(1, "value is required"),
});

export const GET = withApiHandler(async () => {
  const cfg = SecurityConfig.getInstance();
  const mode = cfg.mode;
  const features = cfg.getFeatures();
  const label = getSecurityModeLabel(mode);
  return { mode, features, label };
}, { responsibility: [ResponsibilityType.COE] });

export const PATCH = withApiHandler(
  async (request: NextRequest, { user }) => {
    const payload = patchSchema.parse(await request.json());
    const cfg = SecurityConfig.getInstance();
    await cfg.set(payload.key, payload.value, user!.id);
    return { updated: true };
  },
  { responsibility: [ResponsibilityType.COE] },
);
