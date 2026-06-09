import { Role } from "@prisma/client";
import { QuestionWorkspace } from "@/components/questions/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function ModeratorQuestionsPage() {
  const workspace = await getQuestionContributionWorkspace(Role.MODERATOR);
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Moderation Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Review all submitted questions, override slot reservations when needed, and push revision requests back to contributors.
        </CardContent>
      </Card>
      <QuestionWorkspace actor={workspace.actor} questionBank={workspace.questionBank} mode="moderator" />
    </div>
  );
}
