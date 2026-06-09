import { ExamCycleStatus, ExamType } from "@prisma/client";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";

export default async function ExamCyclesManagementPage() {
  const data = await getAdminData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Examination Cycles</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage academic examination cycles</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Cycles">
          <Table>
            <THead><TR><TH>Academic Year</TH><TH>Semester</TH><TH>Exam Type</TH><TH>Status</TH></TR></THead>
            <TBody>
              {data.examCycles.map((cycle) => (
                <TR key={cycle.id}>
                  <TD className="font-medium">{cycle.academicYear}</TD>
                  <TD>{cycle.semester}</TD>
                  <TD>{cycle.examType}</TD>
                  <TD>{cycle.status}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Create Exam Cycle"
          endpoint="/api/exam-cycles"
          fields={[
            { name: "academicYear", label: "Academic Year", type: "text" },
            { name: "semester", label: "Semester", type: "number" },
            { name: "examType", label: "Exam Type", type: "select", options: Object.values(ExamType).map((value) => ({ value, label: value })) },
            { name: "status", label: "Status", type: "select", options: Object.values(ExamCycleStatus).map((value) => ({ value, label: value })) },
            { name: "departmentId", label: "Department", type: "select", options: data.departments.map((d) => ({ value: d.id, label: d.name })) },
          ]}
        />
      </div>
    </div>
  );
}
