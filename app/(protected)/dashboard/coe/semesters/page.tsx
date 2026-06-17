import { prisma } from "@/lib/db";
import { SemesterForm } from "@/components/forms/semester-form";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function CoeSemestersPage() {
  const [academicYears, semesters] = await Promise.all([
    prisma.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    prisma.semester.findMany({
      orderBy: [{ academicYearId: "desc" }, { number: "asc" }],
      include: { academicYear: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Semesters</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create and manage semesters.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <SemesterForm academicYears={academicYears} />
        <DataTableCard title="Existing Semesters">
          <Table>
            <THead><TR><TH>Number</TH><TH>Name</TH><TH>Academic Year</TH></TR></THead>
            <TBody>
              {semesters.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium">{s.number}</TD>
                  <TD>{s.name}</TD>
                  <TD>{s.academicYear.code}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
      </div>
    </div>
  );
}

