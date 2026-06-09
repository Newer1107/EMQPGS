import { Role } from "@prisma/client";
import { QuestionWorkspace } from "@/components/questions/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function CoordinatorQuestionsPage() {
  const workspace = await getQuestionContributionWorkspace(Role.COORDINATOR);
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Coordinator Read-only View</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Observe reservation progress, review contribution coverage, and track moderation status without editing questions.
        </CardContent>
      </Card>
      <QuestionWorkspace actor={workspace.actor} questionBank={workspace.questionBank} mode="coordinator" />
    </div>
  );
}
