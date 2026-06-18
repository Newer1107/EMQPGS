import type { Metadata } from "next";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";
import { DeleteDepartmentButton, EditDepartmentButton } from "./dept-actions";

export const metadata: Metadata = { title: "Departments — EMQPGS" };

export default async function DepartmentsManagementPage() {
  const data = await getAdminData();
  const departments = data.departments as Array<{ id: string; name: string; code: string; hodName: string; isActive: boolean }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage academic departments"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total Departments</p>
          <p className="mt-1 text-2xl font-bold">{departments.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{departments.filter((d) => d.isActive).length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{departments.filter((d) => !d.isActive).length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Departments">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Code</TH>
                <TH>HOD</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {departments.length === 0 && (
                <TR>
                  <TD colSpan={5}>
                    <EmptyState message="No departments have been created yet" description="Departments represent academic faculties within the institution. Create a department to begin." />
                  </TD>
                </TR>
              )}
              {departments.map((department) => (
                <TR key={department.id}>
                  <TD className="font-medium">{department.name}</TD>
                  <TD><Badge>{department.code}</Badge></TD>
                  <TD>{department.hodName}</TD>
                  <TD>
                    <Badge variant={department.isActive ? "success" : "danger"}>
                      {department.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <EditDepartmentButton department={department} />
                      <DeleteDepartmentButton department={department} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Create Department"
          submitLabel="Create Department"
          endpoint="/api/departments"
          fields={[
            { name: "name", label: "Department Name", type: "text", placeholder: "e.g. Computer Engineering" },
            { name: "code", label: "Department Code", type: "text", placeholder: "e.g. CO" },
            { name: "hodName", label: "Head of Department", type: "text", placeholder: "e.g. Dr. S. R. Patel" },
          ]}
        />
      </div>
    </div>
  );
}

