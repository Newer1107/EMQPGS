import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { MonitoringService } from "@/modules/production/monitoring.service";

const service = new MonitoringService();

export const GET = withApiHandler(async () => service.getObservabilityOverview(), { roles: [Role.COE] });
