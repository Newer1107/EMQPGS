import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { ExportService } from "@/modules/production/export.service";
import { exportRequestSchema } from "@/modules/production/validation";

const service = new ExportService();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.searchParams.get("questionBankId") ?? undefined;
    return service.listExportArtifacts(questionBankId);
  },
  { responsibility: ["COE" as ResponsibilityType] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const payload = exportRequestSchema.parse(await request.json());
    return service.createExport(payload, context.auth!);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "EXPORT_REQUESTED", entityType: "EXPORT_ARTIFACT" } },
);
