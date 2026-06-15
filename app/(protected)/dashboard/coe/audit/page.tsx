import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function AuditPage() {
  const data = await getAdminData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit Trail</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Track all system actions and changes</p>
      </div>
      <DataTableCard title="Audit Log">
        <Table>
          <THead><TR><TH>Action</TH><TH>Entity</TH><TH>Actor</TH><TH>Timestamp</TH></TR></THead>
          <TBody>
            {(data.auditLogs as unknown as Array<{ id: string; action: string; entityType: string; createdAt: string; actor?: { name: string } | null }>).map((log) => (
              <TR key={log.id}>
                <TD>{log.action}</TD>
                <TD>{log.entityType}</TD>
                <TD>{log.actor?.name ?? "System"}</TD>
                <TD className="text-[var(--muted-foreground)]">{new Date(log.createdAt).toLocaleString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
