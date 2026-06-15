import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { SignedReportUpload } from "@/components/forms/signed-report-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const bank = await prisma.questionBank.findUnique({
    where: { id },
    include: { subject: true, examCycle: { include: { academicYear: true, semester: true } } },
  });
  if (!bank) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Upload Signed Report</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {bank.subject.subjectCode} · {bank.examCycle.examType} · {bank.examCycle.semester.name} ({bank.examCycle.academicYear.code})
        </p>
      </div>

      <div className="max-w-md">
        <SignedReportUpload questionBankId={id} />
      </div>

      <Card>
        <CardHeader><CardTitle>Current Status</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-[var(--muted-foreground)]">Status:</span> {bank.status}</p>
          <p><span className="text-[var(--muted-foreground)]">Subject:</span> {bank.subject.subjectName}</p>
          <p><span className="text-[var(--muted-foreground)]">Exam Cycle:</span> {bank.examCycle.examType} · {bank.examCycle.semester.name} · {bank.examCycle.academicYear.code}</p>
        </CardContent>
      </Card>
    </div>
  );
}
