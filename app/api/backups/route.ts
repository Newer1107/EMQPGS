import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { BackupService } from "@/modules/production/backup.service";

const service = new BackupService();

export const POST = withApiHandler(
  async (_request, context) => service.runSystemBackup(context.user!),
  { roles: [Role.COE], audit: { action: "SYSTEM_BACKUP_REQUESTED", entityType: "SYSTEM_BACKUP" } },
);
