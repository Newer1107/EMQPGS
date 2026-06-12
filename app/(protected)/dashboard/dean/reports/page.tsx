import { DeanReviewBoard } from "@/components/production/dean-review-board";
import { getDeanReviewData } from "@/lib/server-data";

export default async function DeanReportsPage() {
  const banks = await getDeanReviewData();

  return (
    <div className="space-y-8">
      <div className="section-frame">
        <p className="page-kicker">Dean</p>
        <h1 className="page-display mt-4">REPORTS</h1>
        <p className="page-lead mt-6">Inspect AI-scored candidate papers and submit the final regular, supplementary, and KT selections.</p>
      </div>
      <DeanReviewBoard banks={banks} />
    </div>
  );
}
