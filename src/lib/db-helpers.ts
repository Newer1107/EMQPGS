import { Prisma } from "@prisma/client";
import { ConflictError } from "@/lib/errors";

const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  Department_code_key: "A department with this code already exists.",
  User_email_key: "A user with this email already exists.",
  Subject_subjectCode_departmentId_key: "This subject code already exists in this department.",
  ExamCycle_semesterId_examType_departmentId_key:
    "An exam cycle with this semester, exam type, and department already exists.",
  QuestionBank_subjectId_examCycleId_key:
    "A question bank already exists for this subject and exam cycle.",
  ModeratorBankAssignment_moderatorId_questionBankId_key:
    "This moderator is already assigned to this question bank.",
  CoordinatorDepartmentAssignment_coordinatorId_departmentId_key:
    "This coordinator is already assigned to this department.",
  SubjectExamCycleLink_subjectId_examCycleId_key:
    "This subject is already linked to this exam cycle.",
  AcademicYear_code_key: "An academic year with this code already exists.",
  Semester_academicYearId_number_key: "This semester number already exists in this academic year.",
  SubjectVersion_subjectId_versionNumber_key: "This version number already exists for this subject.",
  CurriculumSubject_curriculumSchemeId_subjectId_semesterNumbe_key:
    "This subject is already placed in this semester with the same group assignment.",
  Programme_code_key: "A programme with this code already exists.",
  Batch_code_key: "A batch with this code already exists.",
  TeachingGroup_batchId_groupNumber_key: "This teaching group already exists for this batch.",
  AcademicUnit_code_key: "An academic unit with this code already exists.",
  CurriculumScheme_programmeId_year_key: "This year already exists for this programme.",
  BatchSemester_batchId_semesterNumber_key: "This semester number already exists for this batch.",
};

export function handleUniqueConstraint(
  err: unknown,
  constraintName?: string,
): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const fields = (err.meta as { target?: string[] } | undefined)?.target;
    const key = constraintName ?? fields?.join("_") ?? "";
    const message = UNIQUE_CONSTRAINT_MESSAGES[key] ?? "This record already exists.";
    throw new ConflictError(message);
  }
  throw err;
}

export async function withUniqueCheck<T>(
  action: () => Promise<T>,
  constraintName?: string,
): Promise<T> {
  try {
    return await action();
  } catch (err) {
    return handleUniqueConstraint(err, constraintName);
  }
}
