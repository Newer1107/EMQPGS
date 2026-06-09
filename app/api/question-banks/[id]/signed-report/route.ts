import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ReportService } from "@/modules/reports/service";
import { signedReportSchema } from "@/modules/reports/validation";

const service = new ReportService();

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = signedReportSchema.parse(await parseJson(request));
    return service.uploadSignedReport(questionBankId, payload.fileAssetId, context.user!);
  },
  { roles: [Role.MODERATOR], audit: { action: "SIGNED_REPORT_UPLOADED", entityType: "QUESTION_BANK" } },
);
