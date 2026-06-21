import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { AuditService } from "@/lib/auth/audit-service";

export const GET = withApiHandler(async () => {
  const auditService = new AuditService();
  const breaks = await auditService.verifyChain();
  return { intact: breaks.length === 0, breaks };
}, { responsibility: [ResponsibilityType.COE] });
