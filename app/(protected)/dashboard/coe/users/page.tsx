import { Role, UserStatus } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function UsersManagementPage() {
  const data = await getAdminData();
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <DataTableCard title="User Management">
        <Table>
          <THead><TR><TH>Name</TH><TH>Email</TH><TH>Department</TH><TH>Role</TH><TH>Status</TH></TR></THead>
          <TBody>
            {data.users.map((user) => (
              <TR key={user.id}>
                <TD>{user.name}</TD>
                <TD>{user.email}</TD>
                <TD>{user.department?.name ?? "-"}</TD>
                <TD><Badge>{user.role}</Badge></TD>
                <TD>{user.status}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
      <SimpleForm
        title="Create User"
        endpoint="/api/users"
        fields={[
          { name: "name", label: "Name", type: "text" },
          { name: "email", label: "Email", type: "email" },
          { name: "departmentId", label: "Department", type: "select", options: data.departments.map((d) => ({ value: d.id, label: d.name })) },
          { name: "role", label: "Role", type: "select", options: Object.values(Role).map((role) => ({ value: role, label: role })) },
          { name: "status", label: "Status", type: "select", options: Object.values(UserStatus).map((status) => ({ value: status, label: status })) },
          { name: "password", label: "Password", type: "text" },
        ]}
      />
    </div>
  );
}
