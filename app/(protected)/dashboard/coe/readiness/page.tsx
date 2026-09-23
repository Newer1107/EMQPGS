import Link from "next/link";
import { CoeDashboardService } from "@/modules/coe/dashboard.service";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function CoeReadinessPage() {
  const banks = await new CoeDashboardService().getReadinessDashboard();
  return <div className="space-y-6">
    <PageHeader title="Bank Readiness" description="Drafting and moderation banks assessed against their next phase. Empty-slot coverage warnings are separate from blockers." />
    <Link className="underline text-sm" href="/dashboard/coe">Back to COE dashboard</Link>
    <p>{banks.filter((bank) => bank.ready).length} of {banks.length} banks ready to advance</p>
    {banks.length === 0 ? <p>No banks awaiting drafting or moderation advancement.</p> :
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left"><th>Bank</th><th>Next phase</th><th>Readiness</th><th>Blockers and warnings</th></tr></thead>
        <tbody>{banks.map((bank) => <tr key={bank.id} className="border-t align-top">
          <td className="p-3">{bank.subject.subjectCode} · {bank.subject.subjectName}<p>{bank.batchSemester.batch.name} · Sem {bank.batchSemester.semesterNumber} · {bank.batchSemester.academicYear.code}</p></td>
          <td className="p-3">{bank.targetPhase}</td><td className="p-3">{bank.ready ? "Ready" : "Blocked"}</td>
          <td className="p-3"><ul>{bank.issues.map((issue) => <li key={issue}>Blocker: {issue}</li>)}{bank.warnings.map((warning) => <li key={warning}>Warning: {warning}</li>)}</ul>{bank.issues.length + bank.warnings.length === 0 && "No blockers or warnings."}</td>
        </tr>)}</tbody>
      </table></div>}
  </div>;
}
