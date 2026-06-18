import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Academic Setup — EMQPGS" };

export default async function AcademicSetupPage() {
  const [unitCount, programmeCount, schemeCount, subjectCount, batchCount, activeBatchCount, semesters, groupCount] = await Promise.all([
    prisma.academicUnit.count(),
    prisma.programme.count(),
    prisma.curriculumScheme.count(),
    prisma.curriculumSubject.count(),
    prisma.batch.count(),
    prisma.batch.count({ where: { status: "ACTIVE" } }),
    prisma.batchSemester.findMany({ where: { status: "ACTIVE" }, include: { batch: true }, take: 1 }),
    prisma.teachingGroup.count({ where: { isActive: true } }),
  ]);

  const currentSemester = semesters.length > 0 ? `Semester ${semesters[0].semesterNumber} — ${semesters[0].batch.name}` : null;

  const steps = [
    { label: "Academic Units", done: unitCount > 0, count: unitCount, href: "/dashboard/coe/academic-units", desc: "Who teaches the curriculum" },
    { label: "Programmes", done: programmeCount > 0, count: programmeCount, href: "/dashboard/coe/programmes", desc: "Degrees students graduate with" },
    { label: "Curriculum", done: subjectCount > 0, count: schemeCount > 0 ? `${schemeCount} schemes, ${subjectCount} subjects` : "0 schemes", href: "/dashboard/coe/curriculum", desc: "Subjects arranged into semesters" },
    { label: "Batches", done: batchCount > 0, count: batchCount, href: "/dashboard/coe/batches", desc: "Student cohorts progressing through semesters" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Academic Setup"
        description="Set up the foundation for question paper generation. Define who teaches, what degrees are offered, which subjects belong in each semester, and which cohorts of students are progressing through the programme."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/coe/academic-units" className="group">
          <Card className="transition-colors hover:border-[var(--foreground)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Academic Units</CardTitle>
              <CardDescription>{unitCount} unit{unitCount !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-tertiary)]">{unitCount > 0 ? 'ES&H, departments, and more' : 'Not yet configured'}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/coe/programmes" className="group">
          <Card className="transition-colors hover:border-[var(--foreground)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Programmes</CardTitle>
              <CardDescription>{programmeCount} programme{programmeCount !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-tertiary)]">{programmeCount > 0 ? 'BE, BTech, and more' : 'Not yet configured'}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/coe/curriculum" className="group">
          <Card className="transition-colors hover:border-[var(--foreground)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Curriculum</CardTitle>
              <CardDescription>{schemeCount > 0 ? `${schemeCount} scheme${schemeCount !== 1 ? 's' : ''}` : 'Not yet configured'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-tertiary)]">{subjectCount > 0 ? `${subjectCount} subject${subjectCount !== 1 ? 's' : ''} placed` : 'No subjects placed yet'}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/coe/batches" className="group">
          <Card className="transition-colors hover:border-[var(--foreground)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Batches</CardTitle>
              <CardDescription>{batchCount > 0 ? `${activeBatchCount} active` : 'None yet'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-tertiary)]">{batchCount > 0 ? `${batchCount} total batche${batchCount !== 1 ? 's' : ''}` : 'Not yet configured'}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Setup Progress</CardTitle>
          <CardDescription>Complete these steps in order to prepare for question paper generation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <Link key={step.label} href={step.href} className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:border-[var(--foreground)]">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step.done ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                  {step.done ? '✓' : i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{step.label}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">{step.count}</span>
                  </div>
                  <p className="text-sm text-[var(--text-tertiary)]">{step.desc}</p>
                </div>
                <Badge variant={step.done ? "success" : "default"}>
                  {step.done ? 'Done' : 'Start'}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {currentSemester && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Currently Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{currentSemester} is in progress.</p>
          </CardContent>
        </Card>
      )}

      {groupCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Teaching Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{groupCount} teaching group{groupCount !== 1 ? 's are' : ' is'} active across your batches.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

