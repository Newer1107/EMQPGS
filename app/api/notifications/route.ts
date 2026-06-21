import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

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
}, { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType, "MODERATOR" as ResponsibilityType, "CONTRIBUTOR" as ResponsibilityType, "DEAN" as ResponsibilityType] });

export const PATCH = withApiHandler(async (request, context) => {
    const payload = markReadSchema.parse(await request.json());
  if ("markAll" in payload) {
    return service.markAllAsRead(context.user!.id);
  }
  return service.markAsRead(context.user!.id, payload.notificationIds);
}, { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType, "MODERATOR" as ResponsibilityType, "CONTRIBUTOR" as ResponsibilityType, "DEAN" as ResponsibilityType] });
