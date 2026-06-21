import { QuestionStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/get-workspace-context";
import { ModeratorService } from "@/modules/moderation/service";
import { PageHeader } from "@/components/dashboard/page-header";
import { ModerationQuestionsView } from "./moderation-questions-view";

export default async function ModerationQuestionsPage() {
  const { user, context: ctx } = await getWorkspaceContext("MODERATOR");
  const service = new ModeratorService();
  const allQuestions = await service.listQuestions(ctx);
  const questions = allQuestions.filter(
    (q) => q.status === QuestionStatus.PENDING || q.status === QuestionStatus.REVISION_SUBMITTED,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation Queue"
        description="Review and moderate questions assigned to your workspace."
      />
      <ModerationQuestionsView
        questions={JSON.parse(JSON.stringify(questions))}
        actorId={user.id}
      />
    </div>
  );
}
