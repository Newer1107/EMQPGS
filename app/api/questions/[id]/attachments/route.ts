import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionService } from "@/modules/questions/service";
import { attachmentSchema } from "@/modules/questions/validation";

const service = new QuestionService();

export const GET = withApiHandler(async (request, context) => {
  const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
  return service.listAttachments(id, context.user!);
}, { roles: [Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.COE] });

export const POST = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = attachmentSchema.parse(await parseJson(request));
    return service.addAttachment(id, payload.fileAssetId, context.user!);
  },
  { roles: [Role.MODERATOR, Role.CONTRIBUTOR], audit: { action: "QUESTION_ATTACHMENT_ADDED", entityType: "QUESTION_ATTACHMENT", getEntityId: (result) => (result as { id?: string }).id } },
);
