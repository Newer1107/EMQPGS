import { prisma } from "@/lib/db";
import { AcademicYearForm } from "@/components/forms/academic-year-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const statusVariants: Record<string, "success" | "warning" | "default"> = {
  ACTIVE: "success",
  UPCOMING: "warning",
  CLOSED: "default",
};

export default async function CoeAcademicYearsPage() {
  const academicYears = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Years"
        description="Create and manage academic years for reporting purposes."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <AcademicYearForm />
        <DataTableCard title="Existing Academic Years">
          <Table>
            <THead>
              <TR><TH>Code</TH><TH>Start Date</TH><TH>End Date</TH><TH>Status</TH></TR>
            </THead>
            <TBody>
              {academicYears.length === 0 && (
                <TR><TD colSpan={4}><EmptyState message="No academic years have been defined yet" description="Create an academic year to begin organising semesters and exam cycles." /></TD></TR>
              )}
              {academicYears.map((ay) => (
                <TR key={ay.id}>
                  <TD className="font-medium">{ay.code}</TD>
                  <TD>{ay.startDate ? new Date(ay.startDate).toLocaleDateString() : '-'}</TD>
                  <TD>{ay.endDate ? new Date(ay.endDate).toLocaleDateString() : '-'}</TD>
                  <TD><Badge variant={statusVariants[ay.status] ?? "default"}>{ay.status}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
      </div>
    </div>
  );
}
