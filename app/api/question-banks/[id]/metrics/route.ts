import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionBankMetricsService } from "@/modules/question-bank-metrics/service";

const service = new QuestionBankMetricsService();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.getMetrics(questionBankId);
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType, "MODERATOR" as ResponsibilityType, "COE" as ResponsibilityType, "DEAN" as ResponsibilityType] },
);
