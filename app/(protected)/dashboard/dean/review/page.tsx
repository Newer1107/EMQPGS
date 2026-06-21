import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeanReviewWorkspace } from "@/components/production/dean-review-workspace";
import { getDeanReviewData } from "@/lib/server-data";

export default async function DeanReviewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string }>;
}) {
  const { bank } = await searchParams;

  if (!bank) {
    redirect("/dashboard/dean");
  }

  const data = await getDeanReviewData();
  const pendingIds = data.pendingReviews.map((r) => r.id);
  const currentIdx = pendingIds.indexOf(bank);
  const nextBankId = currentIdx >= 0 && currentIdx < pendingIds.length - 1 ? pendingIds[currentIdx + 1] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Generated Papers"
        description="Select an exam type to generate papers, then review and assign one distinct paper to each final exam slot."
      />
      <DeanReviewWorkspace questionBankId={bank} nextBankId={nextBankId} />
    </div>
  );
}
