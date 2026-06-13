import { AssignmentsManager } from "@/components/coordinator/assignments-manager";

export default async function AssignmentsManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Teacher Assignments</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage contributor assignments only within your assigned departments.</p>
      </div>
      <AssignmentsManager />
    </div>
  );
}
