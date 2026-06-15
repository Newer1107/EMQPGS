import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContributorSubmitQuestionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Submit Question</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create and submit questions to the question library.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Question Library</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Questions are stored in the question library and linked to subject versions.</p>
          <p>Use the API to create questions:</p>
          <pre className="rounded-lg bg-[var(--muted)] p-3 text-xs">
            POST /api/question-library{'\n'}{'{'}
            "subjectVersionId": "...",{'\n'}
            "moduleNumber": 1,{'\n'}
            "marks": 5,{'\n'}
            "questionText": "...",{'\n'}
            "coMapping": "CO1",{'\n'}
            "rbtLevel": "L3"{'\n'}
            {'}'}
          </pre>
          <p className="mt-4">
            <Link href="/dashboard/contributor/questions" className="text-[var(--foreground)] underline">
              View my questions →
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
