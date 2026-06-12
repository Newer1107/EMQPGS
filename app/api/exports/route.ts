import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ProductionService } from "@/modules/production/service";
import { exportRequestSchema } from "@/modules/production/validation";

const service = new ProductionService();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.searchParams.get("questionBankId") ?? undefined;
    return service.listExportArtifacts(questionBankId);
  },
  { roles: [Role.COE] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const payload = exportRequestSchema.parse(await parseJson(request));
    return service.createExport(payload, context.user!);
  },
  { roles: [Role.COE], audit: { action: "EXPORT_REQUESTED", entityType: "EXPORT_ARTIFACT" } },
);
