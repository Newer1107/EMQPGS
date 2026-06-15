import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function DepartmentsManagementPage() {
  const data = await getAdminData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Departments</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage academic departments</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Departments">
          <Table>
            <THead><TR><TH>Name</TH><TH>Code</TH><TH>HOD</TH><TH>Active</TH></TR></THead>
            <TBody>
              {(data.departments as Array<{ id: string; name: string; code: string; hodName: string; isActive: boolean }>).map((department) => (
                <TR key={department.id}>
                  <TD className="font-medium">{department.name}</TD>
                  <TD>{department.code}</TD>
                  <TD>{department.hodName}</TD>
                  <TD>{department.isActive ? "Yes" : "No"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Create Department"
          endpoint="/api/departments"
          fields={[
            { name: "name", label: "Department Name", type: "text" },
            { name: "code", label: "Department Code", type: "text" },
            { name: "hodName", label: "HOD Name", type: "text" },
          ]}
        />
      </div>
    </div>
  );
}
