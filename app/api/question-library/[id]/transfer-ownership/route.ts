import { Role } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";

import { QuestionLibraryService } from "@/modules/question-library/service";

const service = new QuestionLibraryService();
const transferSchema = z.object({ toUserId: z.string().min(1), reason: z.string().optional() });

export const POST = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = transferSchema.parse(await request.json());
    return service.transferOwnership(id, payload.toUserId, payload.reason, context.user!);
  },
  { roles: [Role.COORDINATOR], audit: { action: "QUESTION_OWNERSHIP_TRANSFERRED", entityType: "QUESTION_LIBRARY_ITEM" } },
);
