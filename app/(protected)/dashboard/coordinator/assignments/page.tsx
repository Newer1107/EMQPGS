import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AssignmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Assignments</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Moderator assignments are managed through the question bank API.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Assignment Matrix</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p>Assign moderators to question banks using the API:</p>
          <pre className="rounded-lg bg-[var(--muted)] p-3 text-xs mt-2">
            POST /api/question-banks/{"{id}"}/assignments/moderator{'\n'}
            {"{ \"moderatorId\": \"...\" }"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
