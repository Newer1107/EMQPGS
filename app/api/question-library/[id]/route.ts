import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AuthorizationService } from "@/lib/auth/authorization-service";

import { QuestionLibraryService } from "@/modules/question-library/service";
import { questionLibraryUpdateSchema } from "@/modules/question-library/validation";

const service = new QuestionLibraryService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = questionLibraryUpdateSchema.parse(await request.json());
    const authz = new AuthorizationService(context.auth!);
    const isCoordinator = authz.has("COORDINATOR" as ResponsibilityType);
    return service.update(id, payload, { userId: context.auth!.user.id, isCoordinator });
  },
  { responsibility: ["CONTRIBUTOR" as ResponsibilityType, "COORDINATOR" as ResponsibilityType], audit: { action: "QUESTION_EDITED", entityType: "QUESTION_LIBRARY_ITEM" } },
);

export const POST = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const action = request.nextUrl.searchParams.get("action");
    if (action === "submit") {
      return service.submit(id, { userId: context.auth!.user.id });
    }
    return service.update(id, {}, { userId: context.auth!.user.id });
  },
  { responsibility: ["CONTRIBUTOR" as ResponsibilityType], audit: { action: "QUESTION_SUBMITTED", entityType: "QUESTION_LIBRARY_ITEM" } },
);

export const DELETE = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id, { userId: context.auth!.user.id });
  },
  { responsibility: ["CONTRIBUTOR" as ResponsibilityType], audit: { action: "QUESTION_DELETED", entityType: "QUESTION_LIBRARY_ITEM" } },
);
