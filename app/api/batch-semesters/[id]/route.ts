import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { BatchSemesterService } from "@/modules/batch-semesters/service";
import { batchSemesterUpdateSchema, batchSemesterActivateSchema } from "@/modules/batch-semesters/validation";

const service = new BatchSemesterService();

export const GET = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.findById(id);
  },
  { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] },
);

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = batchSemesterUpdateSchema.parse(await request.json());
    return service.update(id, payload);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "BATCH_SEMESTER_UPDATED", entityType: "BATCH_SEMESTER", getEntityId: (r) => (r as { id?: string }).id } },
);

export const POST = withApiHandler(
  async (request) => {
    const url = request.nextUrl;
    const id = url.pathname.split("/").pop()!;
    const action = url.searchParams.get("action");

    if (action === "activate") {
      const payload = batchSemesterActivateSchema.parse(await request.json());
      return service.activate(id, payload);
    }
    if (action === "complete") {
      return service.complete(id);
    }

    return service.findById(id);
  },
  { responsibility: ["COE" as ResponsibilityType] },
);
