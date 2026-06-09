import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { NotificationService } from "@/modules/notifications/service";

const service = new NotificationService();

export const GET = withApiHandler(async (_request, context) => {
  return service.listForUser(context.user!.id);
}, { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.DEAN] });
