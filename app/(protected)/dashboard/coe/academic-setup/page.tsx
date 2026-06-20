import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";

export const metadata: Metadata = { title: "Academic Setup — EMQPGS" };

export default async function AcademicSetupPage() {
  const [departmentCount, academicYearCount, userCount, schemeCount, subjectCount, curriculumSubjectCount, batchCount, activeBatchCount, examCycleCount, semesters, groupCount] = await Promise.all([
    prisma.department.count(),
    prisma.academicYear.count(),
    prisma.user.count(),
    prisma.curriculumScheme.count(),
    prisma.subject.count(),
    prisma.curriculumSubject.count(),
    prisma.batch.count(),
    prisma.batch.count({ where: { status: "ACTIVE" } }),
    prisma.examCycle.count(),
    prisma.batchSemester.findMany({ where: { status: "ACTIVE" }, include: { batch: true }, take: 1 }),
    prisma.teachingGroup.count({ where: { isActive: true } }),
  ]);

  const currentSemester = semesters.length > 0 ? `Semester ${semesters[0].semesterNumber} — ${semesters[0].batch.name}` : null;

  const steps = [
    { label: "Create Departments", done: departmentCount > 0, count: departmentCount, href: "/dashboard/coe/departments", desc: "Academic departments that own subjects" },
    { label: "Create Academic Years", done: academicYearCount > 0, count: academicYearCount, href: "/dashboard/coe/academic-years", desc: "Academic year calendars" },
    { label: "Create Users", done: userCount > 0, count: userCount, href: "/dashboard/coe/users", desc: "Coordinators, contributors, moderators" },
    { label: "Create Curriculum Schemes", done: schemeCount > 0, count: schemeCount, href: "/dashboard/coe/curriculum", desc: "Curriculum frameworks" },
    { label: "Create Subjects", done: subjectCount > 0, count: subjectCount, href: "/dashboard/coe/curriculum", desc: "Subjects offered in the curriculum" },
    { label: "Place in Curriculum", done: curriculumSubjectCount > 0, count: curriculumSubjectCount, href: "/dashboard/coe/curriculum", desc: "Subjects arranged into semesters" },
    { label: "Create Batches", done: batchCount > 0, count: batchCount, href: "/dashboard/coe/batches", desc: "Student cohorts progressing through semesters" },
    { label: "Create Exam Cycles", done: examCycleCount > 0, count: examCycleCount, href: "/dashboard/coe/exam-cycles", desc: "Examination schedules and question banks" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Academic Setup"
        description="Set up the foundation for question paper generation. Define which subjects belong in each semester and which cohorts of students are progressing through their curriculum."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/coe/curriculum" className="group">
          <Card className="transition-colors hover:border-[var(--foreground)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Curriculum</CardTitle>
              <CardDescription>{schemeCount > 0 ? `${schemeCount} scheme${schemeCount !== 1 ? 's' : ''}` : 'Not yet configured'}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-tertiary)]">{curriculumSubjectCount > 0 ? `${curriculumSubjectCount} subject${curriculumSubjectCount !== 1 ? 's' : ''} placed` : 'No subjects placed yet'}</p>
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                  {step.done ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <Circle className="h-6 w-6 text-[var(--text-tertiary)]" />
                  )}
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

