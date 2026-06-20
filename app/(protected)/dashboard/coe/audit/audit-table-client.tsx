"use client";

import { useState, useMemo } from "react";
import { ENTITY_TYPES } from "@/lib/constants";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actor?: { name: string } | null;
};

const entityTypeOptions = Object.values(ENTITY_TYPES);

export function AuditTableClient({ logs }: { logs: AuditLog[] }) {
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (entityFilter && log.entityType !== entityFilter) return false;
      if (dateFrom && new Date(log.createdAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(log.createdAt) > toDate) return false;
      }
      return true;
    });
  }, [logs, entityFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--text-tertiary)]">Entity Type</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]"
          >
            <option value="">All</option>
            {entityTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--text-tertiary)]">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--text-tertiary)]">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--accent)]"
          />
        </div>

        {(entityFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setEntityFilter(""); setDateFrom(""); setDateTo(""); }}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTableCard title={`Audit Log${filtered.length !== 1 ? "s" : ""} (${filtered.length})`}>
        <Table>
          <THead>
            <TR>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Actor</TH>
              <TH>Timestamp</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 && (
              <TR>
                <TD colSpan={4}>
                  <EmptyState message="No audit logs match the current filters" />
                </TD>
              </TR>
            )}
            {filtered.map((log) => (
              <TR key={log.id}>
                <TD>{log.action}</TD>
                <TD>{log.entityType}</TD>
                <TD>{log.actor?.name ?? "System"}</TD>
                <TD className="text-[var(--text-tertiary)]">
                  {new Date(log.createdAt).toLocaleString()}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
    </div>
  );
}
