import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { BatchSemesterService } from "@/modules/batch-semesters/service";

const service = new BatchSemesterService();

export const GET = withApiHandler(
  async (request) => {
    const batchId = request.nextUrl.searchParams.get("batchId");
    const academicUnitId = request.nextUrl.searchParams.get("academicUnitId");
    if (academicUnitId) return service.findActiveByAcademicUnit(academicUnitId);
    if (batchId) return service.findByBatch(batchId);
    return [];
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);
