import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { BatchSemesterService } from "@/modules/batch-semesters/service";

const service = new BatchSemesterService();

export const GET = withApiHandler(
  async (request) => {
    const batchId = request.nextUrl.searchParams.get("batchId");
    const departmentId = request.nextUrl.searchParams.get("departmentId");
    if (departmentId) return service.findActiveByDepartment(departmentId);
    if (batchId) return service.findByBatch(batchId);
    return [];
  },
  { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] },
);
