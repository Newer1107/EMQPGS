import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { QuestionLibraryService } from "@/modules/question-library/service";
import { questionLibraryUpdateSchema } from "@/modules/question-library/validation";

const service = new QuestionLibraryService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = questionLibraryUpdateSchema.parse(await request.json());
    return service.update(id, payload, context.auth!);
  },
  { responsibility: ["CONTRIBUTOR" as ResponsibilityType, "COORDINATOR" as ResponsibilityType], audit: { action: "QUESTION_EDITED", entityType: "QUESTION_LIBRARY_ITEM" } },
);

export const POST = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const action = request.nextUrl.searchParams.get("action");
    if (action === "submit") {
      return service.submit(id, context.auth!);
    }
    return service.update(id, {}, context.auth!);
  },
  { responsibility: ["CONTRIBUTOR" as ResponsibilityType], audit: { action: "QUESTION_SUBMITTED", entityType: "QUESTION_LIBRARY_ITEM" } },
);
