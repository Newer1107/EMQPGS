import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ProductionService } from "@/modules/production/service";

const service = new ProductionService();

export const GET = withApiHandler(async () => service.getObservabilityOverview(), { roles: [Role.COE] });
