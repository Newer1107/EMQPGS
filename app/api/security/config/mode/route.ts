import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { SecurityConfig, SecurityMode } from "@/lib/auth/security-config";

const modeSchema = z.object({
  mode: z.enum(["development", "production"]),
});

export const POST = withApiHandler(
  async (request, { user }) => {
    const { mode } = modeSchema.parse(await request.json());
    const cfg = SecurityConfig.getInstance();
    await cfg.set("SECURITY_MODE", mode, user!.id);
    return { mode, label: `Switched to ${mode} mode` };
  },
  {
    responsibility: ["COE" as ResponsibilityType],
    audit: { action: "SECURITY_MODE_CHANGED", entityType: "SECURITY_CONFIG" },
  },
);
