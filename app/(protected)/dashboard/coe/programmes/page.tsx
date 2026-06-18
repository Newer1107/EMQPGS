import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { DataTableCard } from "@/components/dashboard/data-table-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SimpleForm } from "@/components/dashboard/simple-form";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";

export const metadata: Metadata = { title: "Programmes — EMQPGS" };

export default async function ProgrammesPage() {
  const programmes = await prisma.programme.findMany({
    orderBy: { name: "asc" },
    include: { homeAcademicUnit: true, firstYearAcademicUnit: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes"
        description="A programme is the degree students graduate with. For example, BE Computer Engineering or BE Information Technology."
      />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTableCard title="All Programmes">
          <Table>
            <THead>
              <TR><TH>Name</TH><TH>Code</TH><TH>Degree</TH><TH>Duration</TH><TH>Home Unit</TH><TH>First Year Unit</TH><TH>Status</TH></TR>
            </THead>
            <TBody>
              {programmes.length === 0 && (
                <TR><TD colSpan={7}><EmptyState message="No programmes found" /></TD></TR>
              )}
              {programmes.map((p) => (
                <TR key={p.id}>
                  <TD className="font-medium">{p.name}</TD>
                  <TD><Badge>{p.code}</Badge></TD>
                  <TD>{p.degreeType}</TD>
                  <TD>{p.durationYears} yr / {p.durationSemesters} sem</TD>
                  <TD>{p.homeAcademicUnit?.name ?? '-'}</TD>
                  <TD>{p.firstYearAcademicUnit?.name ?? '-'}</TD>
                  <TD><Badge variant={p.isActive ? "success" : "danger"}>{p.isActive ? "Active" : "Inactive"}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </DataTableCard>

        <div className="space-y-6">
          <SimpleForm
            title="Add Programme"
            endpoint="/api/programmes"
            transform={(p) => ({ ...p, firstYearAcademicUnitId: p.firstYearAcademicUnitId || null })}
            fields={[
              { name: "name", label: "Name", type: "text" },
              { name: "code", label: "Code", type: "text" },
              { name: "degreeType", label: "Degree Type", type: "select", options: [{ value: "BE", label: "BE" }, { value: "BTECH", label: "BTech" }, { value: "MTECH", label: "MTech" }, { value: "PHD", label: "PhD" }, { value: "DIPLOMA", label: "Diploma" }] },
              { name: "durationYears", label: "Duration (years)", type: "number" },
              { name: "durationSemesters", label: "Duration (semesters)", type: "number" },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4">
        <span className="text-sm text-[var(--muted-foreground)]">Next step:</span>
        <Link href="/dashboard/coe/curriculum" className="text-sm font-medium underline">Go to Curriculum</Link>
      </div>
    </div>
  );
}
