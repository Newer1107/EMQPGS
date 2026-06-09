import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function SubjectsManagementPage() {
  const data = await getAdminData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Subjects</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage academic subjects</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Subjects">
          <Table>
            <THead><TR><TH>Code</TH><TH>Name</TH><TH>Year</TH><TH>Semester</TH><TH>Credits</TH><TH>Due Date</TH></TR></THead>
            <TBody>
              {data.subjects.map((subject) => (
                <TR key={subject.id}>
                  <TD className="font-medium">{subject.subjectCode}</TD>
                  <TD>{subject.subjectName}</TD>
                  <TD>{subject.academicYear}</TD>
                  <TD>{subject.semester}</TD>
                  <TD>{subject.credits}</TD>
                  <TD>{subject.questionBankDueDate.toISOString().slice(0, 10)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Create Subject"
          endpoint="/api/subjects"
          fields={[
            { name: "subjectCode", label: "Subject Code", type: "text" },
            { name: "subjectName", label: "Subject Name", type: "text" },
            { name: "academicYear", label: "Academic Year", type: "text" },
            { name: "semester", label: "Semester", type: "number" },
            { name: "credits", label: "Credits", type: "number" },
            { name: "questionBankDueDate", label: "Question Bank Due Date", type: "date" },
            { name: "departmentId", label: "Department", type: "select", options: data.departments.map((d) => ({ value: d.id, label: d.name })) },
          ]}
        />
      </div>
    </div>
  );
}
