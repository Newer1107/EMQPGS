import { withApiHandler } from "@/lib/api-handler";
import { QBAuditService } from "@/modules/qb-audit/service";
export const POST = withApiHandler(async (request, { auth }) => new QBAuditService().finalize(auth!, request.nextUrl.pathname.split("/")[3], await request.json()), { responsibility: "COORDINATOR", successStatus: 201 });
