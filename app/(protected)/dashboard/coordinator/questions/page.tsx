import { Role } from "@prisma/client";
import { QuestionWorkspace } from "@/components/questions/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function CoordinatorQuestionsPage() {
  const workspace = await getQuestionContributionWorkspace(Role.COORDINATOR);
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contribution Monitor</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Read-only view of question contribution progress</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Read-only View</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Observe reservation progress, review contribution coverage, and track moderation status without editing questions.
        </CardContent>
      </Card>
      <QuestionWorkspace actor={workspace.actor} questionBank={workspace.questionBank} mode="coordinator" />
    </div>
  );
}
