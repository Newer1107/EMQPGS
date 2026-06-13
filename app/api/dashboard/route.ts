import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { DashboardService } from "@/modules/dashboard/service";

const service = new DashboardService();

export const GET = withApiHandler(async (_request, context) => {
  return service.getRoleDashboard(context.user!.role, context.user!.id);
}, { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR] });
