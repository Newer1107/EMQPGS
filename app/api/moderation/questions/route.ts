import { QuestionStatus, Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ModeratorService } from "@/modules/moderation/service";

const service = new ModeratorService();

export const GET = withApiHandler(
  async (request, context) => {
    const statusParam = request.nextUrl.searchParams.get("status");
    const statuses = statusParam
      ? statusParam
          .split(",")
          .map((status) => status.trim())
          .filter(Boolean) as QuestionStatus[]
      : undefined;

    return service.listQuestions(context.user!, {
      statuses,
      moduleNumber: request.nextUrl.searchParams.get("module") ? Number(request.nextUrl.searchParams.get("module")) : undefined,
      markType: request.nextUrl.searchParams.get("markType") ? Number(request.nextUrl.searchParams.get("markType")) : undefined,
      bankId: request.nextUrl.searchParams.get("bankId") ?? undefined,
      contributorName: request.nextUrl.searchParams.get("contributorName") ?? undefined,
      sortBy: (request.nextUrl.searchParams.get("sortBy") as "submittedAtAsc" | "submittedAtDesc" | "markType" | "moduleNumber" | null) ?? undefined,
    });
  },
  { roles: [Role.MODERATOR] },
);
