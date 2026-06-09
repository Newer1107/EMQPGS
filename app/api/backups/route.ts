import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ProductionService } from "@/modules/production/service";

const service = new ProductionService();

export const POST = withApiHandler(
  async (_request, context) => service.queueSystemBackup(context.user!),
  { roles: [Role.COE], audit: { action: "SYSTEM_BACKUP_QUEUED", entityType: "SYSTEM_BACKUP" } },
);
