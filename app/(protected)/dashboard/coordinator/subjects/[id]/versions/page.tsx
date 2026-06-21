import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { SubjectVersionForm } from "@/components/forms/subject-version-form";

export default async function SubjectVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  const deptUtils = new DepartmentAccessUtils();

  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!subject) notFound();
  await deptUtils.assertDepartmentAccess(auth, subject.departmentId);

  const versions = await prisma.subjectVersion.findMany({
    where: { subjectId: id },
    orderBy: { versionNumber: "desc" },
    include: { effectiveFromAcademicYear: true },
  });

  const academicYears = await prisma.academicYear.findMany({ orderBy: { startDate: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{subject.subjectName} — Versions</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">{subject.subjectCode} · {subject.department.name}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SubjectVersionForm subjectId={id} academicYears={academicYears} />

        <Card>
          <CardHeader><CardTitle>Version History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Version</TH><TH>Title</TH><TH>Effective From</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
              <TBody>
                {versions.map((v) => (
                  <TR key={v.id}>
                    <TD className="font-medium">v{v.versionNumber}</TD>
                    <TD>{v.title}</TD>
                    <TD>{v.effectiveFromAcademicYear.code}</TD>
                    <TD><Badge>{v.status}</Badge></TD>
                    <TD>
                      {v.status === "ACTIVE" && (
                        <ActionButton
                          label="Archive"
                          endpoint={`/api/subject-versions/${v.id}/archive`}
                          method="PATCH"
                          confirmMessage="Archive this version? A new active version will be needed."
                          successMessage="Version archived"
                          variant="outline"
                          size="sm"
                        />
                      )}
                    </TD>
                  </TR>
                ))}
                {versions.length === 0 && (
                  <TR><TD colSpan={5} className="text-center text-sm text-[var(--text-tertiary)]">No versions yet</TD></TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
