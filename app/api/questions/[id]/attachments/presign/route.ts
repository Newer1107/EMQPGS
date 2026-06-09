import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionService } from "@/modules/questions/service";
import { z } from "zod";

const service = new QuestionService();

const schema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

export const POST = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const payload = schema.parse(await parseJson(request));
    return service.createAttachmentUploadUrl(id, context.user!, payload.fileName, payload.mimeType, payload.size);
  },
  { roles: [Role.MODERATOR, Role.CONTRIBUTOR] },
);
