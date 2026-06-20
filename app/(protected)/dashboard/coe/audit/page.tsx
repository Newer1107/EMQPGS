import { PageHeader } from "@/components/dashboard/page-header";
import { getAdminData } from "@/lib/server-data";
import { AuditTableClient } from "./audit-table-client";

export default async function AuditPage() {
  const data = await getAdminData();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Track all system actions and changes"
      />
      <AuditTableClient logs={data.auditLogs as unknown as Array<{ id: string; action: string; entityType: string; createdAt: string; actor?: { name: string } | null }>} />
    </div>
  );
}

