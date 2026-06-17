import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata: Metadata = { title: "Academic Units — EMQPGS" };

export default async function AcademicUnitsPage() {
  const units = await prisma.academicUnit.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Academic Units</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Academic units represent who teaches a part of the curriculum. For example, ES&amp;H teaches first-year subjects,
          while Computer Engineering teaches department-specific subjects from semester 3 onward.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Academic Units">
          <Table>
            <THead>
              <TR><TH>Name</TH><TH>Code</TH><TH>Type</TH><TH>HOD</TH><TH>Status</TH></TR>
            </THead>
            <TBody>
              {units.length === 0 && <TR><TD colSpan={5} className="text-center text-muted-foreground py-8">No academic units found.</TD></TR>}
              {units.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium">{u.name}</TD>
                  <TD><Badge>{u.code}</Badge></TD>
                  <TD>{u.type === "ES_H" ? "ES&amp;H" : "Department"}</TD>
                  <TD>{u.hodName}</TD>
                  <TD>{u.isActive ? <Badge>Active</Badge> : <Badge className="bg-red-100 text-red-800 border-red-200">Inactive</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>
        <SimpleForm
          title="Add Academic Unit"
          endpoint="/api/academic-units"
          fields={[
            { name: "name", label: "Name", type: "text" },
            { name: "code", label: "Code", type: "text" },
            { name: "hodName", label: "HOD Name", type: "text" },
          ]}
        />
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
        <span className="text-sm text-[var(--muted-foreground)]">Next step:</span>
        <a href="/dashboard/coe/programmes" className="text-sm font-medium underline">Go to Programmes →</a>
      </div>
    </div>
  );
}

