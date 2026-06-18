import { Role, UserStatus } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { CoordinatorAssignmentForm } from "./assign-form";

export default async function CoordinatorAssignmentsPage() {
  await getCurrentUserFromCookies();
  const [assignments, coordinators, departments] = await Promise.all([
    prisma.coordinatorDepartmentAssignment.findMany({
      include: {
        coordinator: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: Role.COORDINATOR, status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coordinator Assignments"
        description="Assign coordinators to academic departments"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total Assignments</p>
          <p className="mt-1 text-2xl font-bold">{assignments.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Coordinators Available</p>
          <p className="mt-1 text-2xl font-bold">{coordinators.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Departments Covered</p>
          <p className="mt-1 text-2xl font-bold">{departments.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="Current Assignments">
          <Table>
            <THead>
              <TR>
                <TH>Coordinator Name</TH>
                <TH>Email</TH>
                <TH>Department</TH>
                <TH>Assigned Date</TH>
                <TH>Action</TH>
              </TR>
            </THead>
            <TBody>
              {assignments.length === 0 && (
                <TR><TD colSpan={5}><EmptyState message="No coordinators have been assigned yet" description="Assign a coordinator to each department to oversee question bank creation and moderation." /></TD></TR>
              )}
              {assignments.map((assignment) => (
                <TR key={assignment.id}>
                  <TD className="font-medium">{assignment.coordinator.name}</TD>
                  <TD>{assignment.coordinator.email}</TD>
                  <TD><Badge>{assignment.department.code}</Badge> {assignment.department.name}</TD>
                  <TD>{assignment.assignedAt.toLocaleDateString()}</TD>
                  <TD>
                    <CoordinatorAssignmentForm
                      type="delete"
                      assignmentId={assignment.id}
                      label={`Remove ${assignment.coordinator.name}`}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <Card>
          <CardHeader><CardTitle>Assign Coordinator</CardTitle></CardHeader>
          <CardContent>
            <CoordinatorAssignmentForm
              type="create"
              coordinators={coordinators.map((c) => ({ value: c.id, label: `${c.name} (${c.email})` }))}
              departments={departments.map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

