import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { NotificationService } from "@/modules/notifications/service";
import { z } from "zod";

const service = new NotificationService();
const markReadSchema = z.union([
  z.object({
    notificationIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    markAll: z.literal(true),
  }),
]);

export const GET = withApiHandler(async (_request, context) => {
  return service.listForUser(context.user!.id, 25);
}, { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.DEAN] });

export const PATCH = withApiHandler(async (request, context) => {
  const payload = markReadSchema.parse(await parseJson(request));
  if ("markAll" in payload) {
    return service.markAllAsRead(context.user!.id);
  }
  return service.markAsRead(context.user!.id, payload.notificationIds);
}, { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.DEAN] });
