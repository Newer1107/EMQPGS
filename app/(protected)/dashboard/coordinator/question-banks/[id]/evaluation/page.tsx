import { notFound } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import { prisma } from "@/lib/db";
import { EvaluationDashboard } from "@/components/evaluation/evaluation-dashboard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ResponsibilityType } from "@prisma/client";

export default async function QuestionBankEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(user.id, user);
  const authz = new AuthorizationService(auth);

  if (!authz.has("COORDINATOR" as ResponsibilityType)) {
    notFound();
  }

  // Verify the question bank exists
  const bank = await prisma.questionBank.findUnique({
    where: { id },
    select: {
      id: true,
      subject: { select: { subjectName: true, subjectCode: true } },
    },
  });

  if (!bank) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/coordinator/question-banks/${id}`}>
          <Button variant="ghost" size="icon" title="Back to bank details">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Academic Evaluation</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            {bank.subject.subjectName} ({bank.subject.subjectCode})
          </p>
        </div>
      </div>
      <EvaluationDashboard questionBankId={id} />
    </div>
  );
}
