import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata: Metadata = { title: "Curriculum Schemes — EMQPGS" };

export default async function CurriculumSchemesPage() {
  const schemes = await prisma.curriculumScheme.findMany({
    orderBy: [{ year: "desc" }, { name: "asc" }],
    include: { programme: { include: { homeAcademicUnit: true } }, _count: { select: { curriculumSubjects: true, batches: true } } },
  });
  const programmes = await prisma.programme.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Curriculum Schemes</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          A curriculum scheme defines which subjects are taught during each semester for a programme.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Curriculum Schemes">
          <Table>
            <THead>
              <TR><TH>Programme</TH><TH>Name</TH><TH>Year</TH><TH>Status</TH><TH>Subjects</TH><TH>Batches</TH></TR>
            </THead>
            <TBody>
              {schemes.length === 0 && <TR><TD colSpan={6} className="text-center text-muted-foreground py-8">No curriculum schemes found.</TD></TR>}
              {schemes.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium">{s.programme?.name ?? '-'}</TD>
                  <TD>{s.name}</TD>
                  <TD>{s.year}</TD>
                  <TD>{s.isActive ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge className="bg-gray-50 text-gray-600 border-gray-300">Inactive</Badge>}</TD>
                  <TD>{s._count.curriculumSubjects}</TD>
                  <TD>{s._count.batches}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Add Curriculum Scheme"
          endpoint="/api/curriculum-schemes"
          fields={[
            { name: "programmeId", label: "Programme ID", type: "text" },
            { name: "name", label: "Name", type: "text" },
            { name: "year", label: "Year", type: "number" },
          ]}
        />
      </div>
    </div>
  );
}

