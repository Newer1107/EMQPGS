import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { ForbiddenError } from "@/lib/errors";
import { StorageService } from "@/lib/storage/storage-service";
import { z } from "zod";

const schema = z.object({
  bucket: z.enum(["question-bank-attachments", "generated-papers", "exports", "audit-files", "system-backups"]),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),

});

export const POST = withApiHandler(
  async (request, context) => {
    const payload = schema.parse(await request.json());
    if ((payload.bucket === "exports" || payload.bucket === "system-backups") && context.user?.role !== Role.COE) {
      throw new ForbiddenError("Only COE can create export or backup storage links");
    }
    return new StorageService().createUploadLink({
      ...payload,
      uploadedById: context.user?.id,
    });
  },
  { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR] },
);
