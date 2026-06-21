import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { BackupService } from "@/modules/production/backup.service";

const service = new BackupService();

export const POST = withApiHandler(
  async (_request, context) => service.runSystemBackup(context.user!),
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "SYSTEM_BACKUP_REQUESTED", entityType: "SYSTEM_BACKUP" } },
);
