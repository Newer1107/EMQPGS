import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeanReviewWorkspace } from "@/components/production/dean-review-workspace";

export default async function DeanReviewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string }>;
}) {
  const { bank } = await searchParams;

  if (!bank) {
    redirect("/dashboard/dean");
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
