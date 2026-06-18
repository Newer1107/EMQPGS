import { Role, UserStatus } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";
import { roleLabels, userStatusLabels } from "@/lib/constants";
import { UserActions } from "./user-actions";
import { EditUserFormWrapper } from "./edit-wrapper";

export default async function UsersManagementPage() {
  const data = await getAdminData();
  const departments = data.departments as Array<{ id: string; name: string }>;
  const users = data.users as Array<{ id: string; name: string; email: string; role: string; status: string; department?: { id: string; name: string } | null }>;

  const activeUsers = users.filter((u) => u.status === "ACTIVE").length;
  const disabledUsers = users.filter((u) => u.status === "DISABLED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage institutional users and their roles"
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total Users</p>
          <p className="mt-1 text-2xl font-bold">{users.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{activeUsers}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Disabled</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{disabledUsers}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Departments</p>
          <p className="mt-1 text-2xl font-bold">{departments.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Users">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Department</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {users.length === 0 && (
                <TR>
                  <TD colSpan={6}>
                    <EmptyState message="No users have been created yet" description="Create a user to assign roles and grant access to the system." />
                  </TD>
                </TR>
              )}
              {users.map((user) => (
                <TR key={user.id}>
                  <TD className="font-medium">{user.name}</TD>
                  <TD>{user.email}</TD>
                  <TD>{user.department?.name ?? "-"}</TD>
                  <TD><Badge>{roleLabels[user.role as keyof typeof roleLabels] ?? user.role}</Badge></TD>
                  <TD>
                    <Badge variant={user.status === "ACTIVE" ? "success" : "danger"}>
                      {userStatusLabels[user.status as keyof typeof userStatusLabels] ?? user.status}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <EditUserFormWrapper user={user} departments={departments} />
                      <UserActions userId={user.id} status={user.status} />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Create User"
          submitLabel="Create User"
          endpoint="/api/users"
          fields={[
            { name: "name", label: "Full Name", type: "text", placeholder: "e.g. Dr. Anil Sharma" },
            { name: "email", label: "Email Address", type: "email", placeholder: "e.g. anil.sharma@college.edu" },
            { name: "departmentId", label: "Department", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) },
            { name: "role", label: "Role", type: "select", options: Object.values(Role).map((role) => ({ value: role, label: roleLabels[role] ?? role })) },
            { name: "status", label: "Account Status", type: "select", options: Object.values(UserStatus).map((s) => ({ value: s, label: userStatusLabels[s] ?? s })) },
            { name: "password", label: "Password", type: "text", placeholder: "Minimum 8 characters" },
          ]}
        />
      </div>
    </div>
  );
}

