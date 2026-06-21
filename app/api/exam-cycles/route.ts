import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { ExamCycleService } from "@/modules/exam-cycles/service";
import { examCycleSchema } from "@/modules/exam-cycles/validation";

const service = new ExamCycleService();

export const GET = withApiHandler(async (request) => {
  const take = parseInt(request.nextUrl.searchParams.get("take") ?? "50", 10);
  const skip = parseInt(request.nextUrl.searchParams.get("skip") ?? "0", 10);
  const batchId = request.nextUrl.searchParams.get("batchId");
  if (batchId) return service.findByBatch(batchId);
  return service.list(take, skip);
}, { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });

export const POST = withApiHandler(
  async (request) => {
    const payload = examCycleSchema.parse(await request.json());
    return service.create(payload);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "EXAM_CYCLE_CREATED", entityType: "EXAM_CYCLE", getEntityId: (result) => (result as { id?: string }).id } },
);
