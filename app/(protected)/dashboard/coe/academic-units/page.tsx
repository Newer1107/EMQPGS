import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";

export const metadata: Metadata = { title: "Academic Units — EMQPGS" };

export default async function AcademicUnitsPage() {
  const units = await prisma.academicUnit.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Units"
        description="Academic units represent who teaches a part of the curriculum. For example, ES&H teaches first-year subjects, while Computer Engineering teaches department-specific subjects from semester 3 onward."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total Units</p>
          <p className="mt-1 text-2xl font-bold">{units.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{units.filter((u) => u.isActive).length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{units.filter((u) => !u.isActive).length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Academic Units">
          <Table>
            <THead>
              <TR><TH>Name</TH><TH>Code</TH><TH>Type</TH><TH>HOD</TH><TH>Status</TH></TR>
            </THead>
            <TBody>
              {units.length === 0 && (
                <TR><TD colSpan={5}><EmptyState message="No academic units have been added yet" description="Academic units represent who teaches the curriculum — for example, ES&H or Computer Engineering." /></TD></TR>
              )}
              {units.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium">{u.name}</TD>
                  <TD><Badge>{u.code}</Badge></TD>
                  <TD><Badge variant="info">{u.type === "ES_H" ? "ES&H" : "Department"}</Badge></TD>
                  <TD>{u.hodName}</TD>
                  <TD><Badge variant={u.isActive ? "success" : "danger"}>{u.isActive ? "Active" : "Inactive"}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Add Academic Unit"
          submitLabel="Add Academic Unit"
          endpoint="/api/academic-units"
          fields={[
            { name: "name", label: "Unit Name", type: "text", placeholder: "e.g. Computer Engineering" },
            { name: "code", label: "Unit Code", type: "text", placeholder: "e.g. CO" },
            { name: "hodName", label: "Head of Unit", type: "text", placeholder: "e.g. Dr. A. R. Rao" },
          ]}
        />
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
        <span className="text-sm text-[var(--text-tertiary)]">Next step:</span>
        <Link href="/dashboard/coe/programmes" className="text-sm font-medium underline">Go to Programmes →</Link>
      </div>
    </div>
  );
}

