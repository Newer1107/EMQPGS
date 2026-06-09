import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminData } from "@/lib/server-data";
import { questionBankStatusLabels } from "@/lib/constants";

export default async function QuestionBanksManagementPage() {
  const data = await getAdminData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Question Banks</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage question banks for each subject and exam cycle</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Question Banks">
          <Table>
            <THead><TR><TH>Subject</TH><TH>Cycle</TH><TH>Status</TH></TR></THead>
            <TBody>
              {data.questionBanks.map((bank) => (
                <TR key={bank.id}>
                  <TD className="font-medium">{bank.subject.subjectCode}</TD>
                  <TD>{bank.examCycle.academicYear} / S{bank.examCycle.semester}</TD>
                  <TD><Badge>{questionBankStatusLabels[bank.status] ?? bank.status}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Create Question Bank"
          endpoint="/api/question-banks"
          fields={[
            { name: "subjectId", label: "Subject", type: "select", options: data.subjects.map((s) => ({ value: s.id, label: `${s.subjectCode} - ${s.subjectName}` })) },
            { name: "examCycleId", label: "Exam Cycle", type: "select", options: data.examCycles.map((cycle) => ({ value: cycle.id, label: `${cycle.academicYear} / S${cycle.semester} / ${cycle.examType}` })) },
          ]}
        />
      </div>
    </div>
  );
}
