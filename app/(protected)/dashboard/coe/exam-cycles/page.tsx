import { ExamCycleTimetableManager } from "@/components/dashboard/exam-cycle-timetable-manager";
import { getAdminData } from "@/lib/server-data";

export default async function ExamCyclesManagementPage() {
  const data = await getAdminData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Examination Cycles</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create and store examination timetable sheets directly inside each academic cycle</p>
      </div>
      <ExamCycleTimetableManager
        departments={data.departments.map((department) => ({ id: department.id, name: department.name }))}
        initialCycles={data.examCycles.map((cycle) => ({
          id: cycle.id,
          academicYear: cycle.academicYear,
          semester: cycle.semester,
          examType: cycle.examType,
          status: cycle.status,
          departmentId: cycle.departmentId,
          timetableDocumentRef: cycle.timetableDocumentRef,
          timetableIssueDate: cycle.timetableIssueDate,
          timetableTitle: cycle.timetableTitle,
          timetableBranch: cycle.timetableBranch,
          timetableRows: cycle.timetableRows,
          timetableSignature: cycle.timetableSignature,
        }))}
      />
    </div>
  );
}
