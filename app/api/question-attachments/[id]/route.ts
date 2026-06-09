import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionService } from "@/modules/questions/service";
import { attachmentReplaceSchema } from "@/modules/questions/validation";

const service = new QuestionService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = attachmentReplaceSchema.parse(await parseJson(request));
    return service.replaceAttachment(id, payload.fileAssetId, context.user!);
  },
  { roles: [Role.MODERATOR, Role.CONTRIBUTOR], audit: { action: "QUESTION_ATTACHMENT_REPLACED", entityType: "QUESTION_ATTACHMENT", getEntityId: (result) => (result as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.deleteAttachment(id, context.user!);
  },
  { roles: [Role.MODERATOR, Role.CONTRIBUTOR], audit: { action: "QUESTION_ATTACHMENT_DELETED", entityType: "QUESTION_ATTACHMENT", getEntityId: (result) => (result as { id?: string }).id } },
);
