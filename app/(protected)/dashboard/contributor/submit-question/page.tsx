import { Role } from "@prisma/client";
import { QuestionWorkspace } from "@/components/questions/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionContributionWorkspace } from "@/lib/server-data";

export default async function ContributorSubmitQuestionPage() {
  const workspace = await getQuestionContributionWorkspace(Role.CONTRIBUTOR);
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Submit Question</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Claim a slot, draft a question, and submit it into the moderation workflow.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Submission Guidance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Complete the slot reservation and question form below. Attachments are uploaded through signed URLs and linked to your submission.
        </CardContent>
      </Card>
      <QuestionWorkspace actor={workspace.actor} questionBank={workspace.questionBank} mode="contributor" />
    </div>
  );
}
