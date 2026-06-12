import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ProductionService } from "@/modules/production/service";

const service = new ProductionService();

export const POST = withApiHandler(
  async (_request, context) => service.runSystemBackup(context.user!),
  { roles: [Role.COE], audit: { action: "SYSTEM_BACKUP_REQUESTED", entityType: "SYSTEM_BACKUP" } },
);
