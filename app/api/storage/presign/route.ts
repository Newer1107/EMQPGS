import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { StorageService } from "@/lib/storage/storage-service";
import { z } from "zod";

const schema = z.object({
  bucket: z.enum(["question-bank-attachments", "signed-reports", "generated-papers", "exports", "audit-files"]),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  linkedEntityType: z.string().optional(),
  linkedEntityId: z.string().optional(),
});

export const POST = withApiHandler(
  async (request, context) => {
    const payload = schema.parse(await parseJson(request));
    return new StorageService().createUploadLink({
      ...payload,
      uploadedById: context.user?.id,
    });
  },
  { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.DEAN] },
);
