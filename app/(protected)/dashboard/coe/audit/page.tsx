import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function AuditPage() {
  const data = await getAdminData();
  return (
    <DataTableCard title="Audit Trail">
      <Table>
        <THead><TR><TH>Action</TH><TH>Entity</TH><TH>Actor</TH><TH>Timestamp</TH></TR></THead>
        <TBody>
          {data.auditLogs.map((log) => (
            <TR key={log.id}>
              <TD>{log.action}</TD>
              <TD>{log.entityType}</TD>
              <TD>{log.actor?.name ?? "System"}</TD>
              <TD>{log.createdAt.toISOString()}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </DataTableCard>
  );
}
