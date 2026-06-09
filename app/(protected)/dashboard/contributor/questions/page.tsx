import { Role } from "@prisma/client";
import { QuestionWorkspace } from "@/components/questions/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function ContributorQuestionsPage() {
  const workspace = await getQuestionContributionWorkspace(Role.CONTRIBUTOR);
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Questions</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Claim slots, draft questions, and submit for moderation</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contributor Workspace</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Claim slots, draft questions, upload attachments, and submit work for moderation.
        </CardContent>
      </Card>
      <QuestionWorkspace actor={workspace.actor} questionBank={workspace.questionBank} mode="contributor" />
    </div>
  );
}
