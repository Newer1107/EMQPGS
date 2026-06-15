import { prisma } from "@/lib/db";
import { AcademicYearForm } from "@/components/forms/academic-year-form";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function CoeAcademicYearsPage() {
  const academicYears = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: { semesters: { orderBy: { number: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Academic Years</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create and manage academic years.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <AcademicYearForm />
        <DataTableCard title="Existing Academic Years">
          <Table>
            <THead><TR><TH>Code</TH><TH>Start Date</TH><TH>End Date</TH><TH>Status</TH><TH>Semesters</TH></TR></THead>
            <TBody>
              {academicYears.map((ay) => (
                <TR key={ay.id}>
                  <TD className="font-medium">{ay.code}</TD>
                  <TD>{new Date(ay.startDate).toLocaleDateString()}</TD>
                  <TD>{new Date(ay.endDate).toLocaleDateString()}</TD>
                  <TD>{ay.status}</TD>
                  <TD>{ay.semesters.map((s) => `Sem ${s.number} (${s.name})`).join(", ") || "None"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
      </div>
    </div>
  );
}
