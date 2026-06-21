import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ExportService } from "@/modules/production/export.service";

const service = new ExportService();

export const GET = withApiHandler(
  async (request, context) => {
    const exportId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.createExportDownloadLink(exportId, context.auth!);
  },
  { responsibility: ["COE" as ResponsibilityType] },
);
