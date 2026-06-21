import { QuestionStatus } from "@prisma/client";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { ModeratorService } from "@/modules/moderation/service";
import { PageHeader } from "@/components/dashboard/page-header";
import { ModerationQuestionsView } from "./moderation-questions-view";

export default async function ModerationQuestionsPage() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  const service = new ModeratorService();
  const allQuestions = await service.listQuestions(auth);
  const questions = allQuestions.filter(
    (q) => q.status === QuestionStatus.PENDING || q.status === QuestionStatus.REVISION_SUBMITTED,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation Queue"
        description="Review and moderate questions from the question library."
      />
      <ModerationQuestionsView
        questions={JSON.parse(JSON.stringify(questions))}
        actorId={actor.id}
      />
    </div>
  );
}
