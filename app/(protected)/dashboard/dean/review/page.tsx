import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeanReviewWorkspace } from "@/components/production/dean-review-workspace";

export default async function DeanReviewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string }>;
}) {
  const { bank } = await searchParams;

  if (!bank) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Review Generated Papers"
          description="Select a question bank to review from the dean dashboard to see paper variants here."
        />
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-[var(--muted-foreground)]">No question bank selected. Go to your <Link href="/dashboard/dean" className="underline underline-offset-4">Dean Dashboard</Link> to find banks awaiting review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Generated Papers"
        description="Compare papers A, B, and C, then assign one distinct paper to each final exam slot."
      />
      <DeanReviewWorkspace questionBankId={bank} />
    </div>
  );
}
