import { Role } from "@prisma/client";
import { QuestionWorkspace } from "@/components/questions/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function ModeratorQuestionsPage() {
  const workspace = await getQuestionContributionWorkspace(Role.MODERATOR);
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Moderation Queue</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Review and moderate submitted questions</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Moderation Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Review all submitted questions, override slot reservations when needed, and push revision requests back to contributors.
        </CardContent>
      </Card>
      <QuestionWorkspace actor={workspace.actor} questionBank={workspace.questionBank} mode="moderator" />
    </div>
  );
}
