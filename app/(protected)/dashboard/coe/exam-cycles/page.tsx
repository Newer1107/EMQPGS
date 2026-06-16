import { ExamCycleTimetableManager } from "@/components/dashboard/exam-cycle-timetable-manager";
import { prisma } from "@/lib/db";

export default async function CoeExamCyclesPage() {
  const [departments, academicYears, examCycles] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    prisma.examCycle.findMany({
      orderBy: { createdAt: "desc" },
      include: { academicYear: true, semester: true, department: true },
    }),
  ]);

  const initialCycles = examCycles.map((cycle) => ({
    id: cycle.id,
    academicYearId: cycle.academicYearId,
    semesterId: cycle.semesterId,
    academicYear: cycle.academicYear,
    semester: cycle.semester,
    examType: cycle.examType,
    status: cycle.status,
    departmentId: cycle.departmentId,
    department: cycle.department,
    timetableDocumentRef: cycle.timetableDocumentRef,
    timetableIssueDate: cycle.timetableIssueDate,
    timetableTitle: cycle.timetableTitle,
    timetableRows: cycle.timetableRows,
    timetableSignature: cycle.timetableSignature,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Exam Cycles</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create and manage examination cycles.</p>
      </div>
      <ExamCycleTimetableManager
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        academicYears={academicYears.map((ay) => ({ id: ay.id, code: ay.code, activeSemesterType: ay.activeSemesterType }))}
        initialCycles={initialCycles}
      />
    </div>
  );
}
