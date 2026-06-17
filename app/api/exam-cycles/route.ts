import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ExamCycleService } from "@/modules/exam-cycles/service";
import { examCycleSchema, batchExamCycleSchema } from "@/modules/exam-cycles/validation";

const service = new ExamCycleService();

export const GET = withApiHandler(async (request) => {
  const take = parseInt(request.nextUrl.searchParams.get("take") ?? "50", 10);
  const skip = parseInt(request.nextUrl.searchParams.get("skip") ?? "0", 10);
  const batchId = request.nextUrl.searchParams.get("batchId");
  if (batchId) return service.findByBatch(batchId);
  return service.list(take, skip);
}, { roles: [Role.COE, Role.COORDINATOR] });

export const POST = withApiHandler(
  async (request) => {
    const raw: Record<string, unknown> = await parseJson(request);
    if ("batchSemesterId" in raw) {
      const payload = batchExamCycleSchema.parse(raw);
      return service.createFromBatch(payload);
    }
    const payload = examCycleSchema.parse(raw);
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "EXAM_CYCLE_CREATED", entityType: "EXAM_CYCLE", getEntityId: (result) => (result as { id?: string }).id } },
);
