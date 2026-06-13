import { notFound } from "next/navigation";
import { DeanReviewWorkspace } from "@/components/production/dean-review-workspace";

export default async function DeanReviewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string }>;
}) {
  const { bank } = await searchParams;

  if (!bank) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="section-frame">
        <p className="page-kicker">Dean</p>
        <h1 className="page-display mt-4">REVIEW GENERATED PAPERS</h1>
        <p className="page-lead mt-6">Compare papers A, B, and C, then assign one distinct paper to each final exam slot.</p>
      </div>
      <DeanReviewWorkspace questionBankId={bank} />
    </div>
  );
}
