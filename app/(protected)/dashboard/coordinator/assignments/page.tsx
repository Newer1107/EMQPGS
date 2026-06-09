import { Role } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function AssignmentsManagementPage() {
  const data = await getAdminData();
  const teachers = data.users.filter((user) => user.role !== Role.COE && user.role !== Role.DEAN);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <DataTableCard title="Teacher Assignments">
        <Table>
          <THead><TR><TH>Subject</TH><TH>Teacher</TH><TH>Assignment</TH></TR></THead>
          <TBody>
            {data.assignments.map((assignment) => (
              <TR key={assignment.id}>
                <TD>{assignment.questionBank.subject.subjectCode}</TD>
                <TD>{assignment.teacher.name}</TD>
                <TD>{assignment.assignmentRole}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </DataTableCard>
      <SimpleForm
        title="Assign Teachers"
        endpoint="/api/assignments"
        transform={(payload) => ({
          questionBankId: payload.questionBankId,
          moderatorId: payload.moderatorId || undefined,
          contributorIds: (() => {
            try {
              return JSON.parse(String(payload.contributorIds || "[]"));
            } catch {
              return [];
            }
          })(),
        })}
        fields={[
          { name: "questionBankId", label: "Question Bank", type: "select", options: data.questionBanks.map((bank) => ({ value: bank.id, label: bank.subject.subjectCode })) },
          { name: "moderatorId", label: "Moderator", type: "select", options: teachers.filter((user) => user.role === Role.MODERATOR).map((user) => ({ value: user.id, label: user.name })) },
          { name: "contributorIds", label: "Contributor IDs (JSON array)", type: "textarea" },
        ]}
      />
    </div>
  );
}
