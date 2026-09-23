import { withApiHandler } from "@/lib/api-handler";
import { getWorkspaceContext } from "@/lib/auth/get-workspace-context";
import { BulkModerationService, bulkModerationSchema } from "@/modules/moderation/bulk-service";

export const POST = withApiHandler(async request => {
  const session = await getWorkspaceContext("MODERATOR");
  const input = bulkModerationSchema.parse(await request.json());
  return new BulkModerationService().run({ userId: session.user.id, bankId: session.active.scopeId! }, input);
}, {
  responsibility: "MODERATOR",
  audit: { action: "QUESTIONS_BULK_MODERATED", entityType: "QUESTION_BANK", getMetadata: (_request, result) => ({ results: (result as { results: unknown }).results }) },
});
