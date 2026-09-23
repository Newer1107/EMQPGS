import Link from "next/link";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { QBAuditService } from "@/modules/qb-audit/service";
import { AuditWorkspace } from "@/components/qb-audit/audit-workspace";

export default async function BankAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUserFromCookies();
  const auth = await new ResponsibilityResolver().resolveAsContext(user.id, user);
  const data = await new QBAuditService().get(auth, id);
  return <main className="space-y-6">
    <Link href={`/dashboard/coordinator/question-banks/${id}`}>← Back to bank</Link>
    <h1 className="text-2xl font-semibold">Question bank audit · {data.bank.subjectName}</h1>
    <AuditWorkspace bankId={id} />
  </main>;
}
