import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function AuditPage() {
  const data = await getAdminData();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Track all system actions and changes"
      />
      <DataTableCard title="Audit Log">
        <Table>
          <THead><TR><TH>Action</TH><TH>Entity</TH><TH>Actor</TH><TH>Timestamp</TH></TR></THead>
          <TBody>
            {(data.auditLogs as unknown as Array<{ id: string; action: string; entityType: string; createdAt: string; actor?: { name: string } | null }>).length === 0 && (
              <TR><TD colSpan={4}><EmptyState message="No audit logs" /></TD></TR>
            )}
            {(data.auditLogs as unknown as Array<{ id: string; action: string; entityType: string; createdAt: string; actor?: { name: string } | null }>).map((log) => (
              <TR key={log.id}>
                <TD>{log.action}</TD>
                <TD>{log.entityType}</TD>
                <TD>{log.actor?.name ?? "System"}</TD>
                <TD className="text-[var(--text-tertiary)]">{new Date(log.createdAt).toLocaleString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

