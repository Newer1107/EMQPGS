import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function DepartmentsManagementPage() {
  const data = await getAdminData();
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <DataTableCard title="Departments">
        <Table>
          <THead><TR><TH>Name</TH><TH>Code</TH><TH>HOD</TH><TH>Active</TH></TR></THead>
          <TBody>
            {data.departments.map((department) => (
              <TR key={department.id}>
                <TD>{department.name}</TD>
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
  );
}
