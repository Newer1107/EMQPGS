import Link from "next/link";

type Bank = {
  id: string; subjectCode: string; subjectName: string; examCycleLabel: string;
  qualityScore: number | null; coverageScore: number | null; daysWaiting: number;
};

export function DeanBankComparison({ banks, currentBankId }: { banks: Bank[]; currentBankId?: string }) {
  return <section className="rounded-lg border p-4 space-y-3">
    <h2 className="font-semibold">Compare Pending Banks</h2>
    <p className="text-sm">Compare recorded paper scores across banks, then open a review. Scores may reflect different subjects and exam patterns.</p>
    {banks.length === 0 ? <p>No pending banks to compare.</p> : <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left"><th>Bank</th><th>Cycle</th><th>Quality /10</th><th>Coverage</th><th>Waiting</th><th>Review</th></tr></thead>
      <tbody>{banks.map((bank) => <tr key={bank.id} className="border-t">
        <td className="py-3 pr-3">{bank.subjectCode} · {bank.subjectName}</td><td>{bank.examCycleLabel}</td>
        <td>{bank.qualityScore ?? "Unavailable"}</td><td>{bank.coverageScore == null ? "Unavailable" : `${bank.coverageScore}%`}</td><td>{bank.daysWaiting}d</td>
        <td><Link aria-current={bank.id === currentBankId ? "page" : undefined} className="underline" href={`/dashboard/dean/review?bank=${encodeURIComponent(bank.id)}`}>{bank.id === currentBankId ? "Current review" : "Open review"}</Link></td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
