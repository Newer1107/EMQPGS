import Link from "next/link";
import { questionBankPhaseLabels } from "@/lib/constants";

type ProgressSlot = { moduleNumber: number; assignedQuestion: { status: string } | null };
export function moduleCompletion(slots: ProgressSlot[], modules: number[], expectedPerModule = 0) {
  return [...new Set([...modules, ...slots.map(s => s.moduleNumber)])].sort((a, b) => a - b).map(moduleNumber => {
    const group = slots.filter(s => s.moduleNumber === moduleNumber);
    const total = Math.max(expectedPerModule, group.length);
    const filled = group.filter(s => s.assignedQuestion !== null).length;
    const approved = group.filter(s => s.assignedQuestion?.status === "APPROVED").length;
    const revisions = group.filter(s => ["REVISION_REQUESTED", "REVISION_SUBMITTED"].includes(s.assignedQuestion?.status ?? "")).length;
    return { moduleNumber, total, filled, approved, empty: total - filled, revisions };
  });
}

export function ModuleCompletionSummary({ slots, modules, expectedPerModule }: { slots: ProgressSlot[]; modules: number[]; expectedPerModule: number }) {
  const rows = moduleCompletion(slots, modules, expectedPerModule);
  return <section aria-label="Module completion" className="space-y-2">
    <h3 className="text-sm font-semibold">Module completion</h3>
    <p className="text-xs text-[var(--text-tertiary)]">Approved and revisions are subsets of filled slots. Revisions includes requested and resubmitted questions.</p>
    <div className="space-y-2">{rows.map(row => <div key={row.moduleNumber} className="rounded border p-2 text-xs">
      <p className="font-medium">Module {row.moduleNumber}</p>
      <p>{row.filled}/{row.total} filled · {row.approved} approved · {row.empty} empty · {row.revisions} revisions</p>
    </div>)}</div>
  </section>;
}

export function CoordinatorBankEvidenceLinks({ bankId }: { bankId: string }) {
  const base = `/dashboard/coordinator/question-banks/${encodeURIComponent(bankId)}`;
  return <nav aria-label="Academic evidence and audit" className="space-y-2">
    <Link className="block rounded border p-3 text-sm font-medium hover:bg-[var(--surface-hover)]" href={`${base}/audit`}>Question Bank Audit →</Link>
    <Link className="block rounded border p-3 text-sm font-medium hover:bg-[var(--surface-hover)]" href={`${base}/uaf-review`}>Academic Evidence Review →</Link>
  </nav>;
}

type ComparisonBank = {
  id: string; subjectName: string; subjectCode: string; semesterLabel: string; department: string;
  phase: string; totalSlots: number; filledCount: number; approvedCount: number; pendingModerationCount: number;
};
export function CoordinatorBankComparison({ banks }: { banks: ComparisonBank[] }) {
  return <section className="space-y-3 rounded-lg border p-4">
    <h2 className="font-semibold">Compare Question Banks</h2>
    <p className="text-sm text-[var(--text-tertiary)]">Compare completion across assigned banks. Approved and pending counts are included in filled slots; completion is separate from academic quality.</p>
    {banks.length === 0 ? <p className="text-sm">No assigned question banks to compare.</p> : <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left">{["Bank", "Semester", "Phase", "Filled", "Approved", "Empty", "Pending review", "Actions"].map(label => <th scope="col" className="px-2 py-2" key={label}>{label}</th>)}</tr></thead>
      <tbody>{banks.map(bank => <tr className="border-t" key={bank.id}>
        <th scope="row" className="px-2 py-3 text-left font-medium">{bank.subjectCode} · {bank.subjectName}<p className="text-xs font-normal">{bank.department}</p></th>
        <td className="px-2">{bank.semesterLabel}</td>
        <td className="px-2">{questionBankPhaseLabels[bank.phase as keyof typeof questionBankPhaseLabels] ?? bank.phase}</td>
        <td className="px-2 tabular-nums">{bank.filledCount}/{bank.totalSlots}{bank.totalSlots > 0 ? ` (${Math.round(bank.filledCount / bank.totalSlots * 100)}%)` : " (N/A)"}</td>
        <td className="px-2 tabular-nums">{bank.approvedCount}</td><td className="px-2 tabular-nums">{Math.max(0, bank.totalSlots - bank.filledCount)}</td><td className="px-2 tabular-nums">{bank.pendingModerationCount}</td>
        <td className="space-x-3 whitespace-nowrap px-2"><Link className="underline" href={`/dashboard/coordinator/question-banks/${encodeURIComponent(bank.id)}`}>Manage</Link><Link className="underline" href={`/dashboard/coordinator/analysis?bank=${encodeURIComponent(bank.id)}`}>UAF report</Link></td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
