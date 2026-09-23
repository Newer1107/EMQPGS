import { withApiHandler } from "@/lib/api-handler";
import { QBAuditService } from "@/modules/qb-audit/service";
const service = new QBAuditService();
export const GET = withApiHandler(async (request, { auth }) => (await service.get(auth!, request.nextUrl.pathname.split("/")[3])).blueprints, { responsibility: "COORDINATOR" });
export const POST = withApiHandler(async (request, { auth }) => service.saveBlueprint(auth!, request.nextUrl.pathname.split("/")[3], await request.json()), { responsibility: "COORDINATOR", successStatus: 201 });
