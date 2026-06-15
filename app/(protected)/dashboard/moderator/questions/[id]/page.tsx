import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ModeratorService } from "@/modules/moderation/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { questionStatusLabels, difficultyLabels } from "@/lib/constants";
import { ModeratorActions } from "@/components/forms/moderator-actions";

export default async function ModeratorQuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();

  const question = await prisma.questionLibraryItem.findUnique({
    where: { id },
    include: {
      subjectVersion: {
        include: { subject: { include: { department: true } }, effectiveFromAcademicYear: true },
      },
      creator: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, name: true, email: true } },
      bankLinks: {
        include: { questionBank: { include: { examCycle: { include: { academicYear: true, semester: true } } } } },
      },
      moderationEvents: {
        orderBy: { createdAt: "desc" },
        include: { moderator: { select: { name: true } } },
      },
    },
  });
  if (!question) notFound();

  const service = new ModeratorService();
  const allQuestions = await service.listQuestions(actor);
  const queueIds = allQuestions.map((q: { id: string }) => q.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Question Detail</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {question.subjectVersion.subject.subjectCode} · Module {question.moduleNumber} · {question.marks} marks
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Question</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{question.questionText}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-[var(--muted-foreground)]">Subject</dt><dd className="font-medium">{question.subjectVersion.subject.subjectName}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Department</dt><dd>{question.subjectVersion.subject.department.name}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Module</dt><dd>{question.moduleNumber}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Marks</dt><dd>{question.marks}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Course Outcome</dt><dd>{question.coMapping}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">RBT Level</dt><dd>{question.rbtLevel}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Difficulty</dt><dd>{question.difficultyLevel ? difficultyLabels[question.difficultyLevel as keyof typeof difficultyLabels] : "Not set"}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Status</dt><dd><Badge>{questionStatusLabels[question.status] ?? question.status}</Badge></dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Creator</dt><dd>{question.creator.name}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Owner</dt><dd>{question.owner.name}</dd></div>
              </dl>
            </CardContent>
          </Card>

          {question.bankLinks.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Linked Question Banks</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {question.bankLinks.map((link) => (
                    <li key={link.id}>
                      {link.questionBank.examCycle.examType} · {link.questionBank.examCycle.semester.name} ({link.questionBank.examCycle.academicYear.code})
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {question.moderationEvents.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Moderation History</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {question.moderationEvents.map((event) => (
                    <li key={event.id} className="flex items-start gap-2">
                      <span className="font-medium">{event.action.replace(/_/g, " ")}</span>
                      <span className="text-[var(--muted-foreground)]">by {event.moderator.name}</span>
                      {event.note && <span className="italic">— {event.note}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <ModeratorActions questionId={id} status={question.status} queueIds={queueIds} />
        </div>
      </div>
    </div>
  );
}
