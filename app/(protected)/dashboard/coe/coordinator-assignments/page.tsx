import { Role, UserStatus } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Coordinator Department Assignments</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Assign coordinators to academic departments</p>
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
              {assignments.length === 0 && (
                <TR><TD colSpan={5} className="text-center text-[var(--muted-foreground)] py-8">No assignments found</TD></TR>
              )}
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
