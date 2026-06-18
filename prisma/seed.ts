import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // Academic Years
  const ay = await prisma.academicYear.create({
    data: { code: "2026-2027", startDate: new Date("2026-06-01"), endDate: new Date("2027-05-31"), status: "ACTIVE" },
  });

  // Departments (HR)
  const dept = await prisma.department.create({
    data: { name: "Computer Engineering", code: "COMP", hodName: "Dr. Suresh Patil" },
  });

  // Academic Units
  const eshUnit = await prisma.academicUnit.create({
    data: { name: "Engineering Sciences & Humanities", code: "ESH", type: "ES_H", hodName: "Dr. First Year" },
  });
  const compUnit = await prisma.academicUnit.create({
    data: { name: "Computer Engineering", code: "COMP", type: "DEPARTMENT", hodName: "Dr. Suresh Patil" },
  });

  // Users
  const coe = await prisma.user.create({
    data: { name: "Dr. Mahesh Kulkarni", email: "coe@emqpgs.local", role: "COE", passwordHash, status: "ACTIVE" },
  });

  // Programme
  const prog = await prisma.programme.create({
    data: { name: "BE Computer Engineering", code: "BECOMP", homeAcademicUnitId: compUnit.id, firstYearAcademicUnitId: eshUnit.id },
  });

  // Curriculum Scheme
  const scheme = await prisma.curriculumScheme.create({
    data: { programmeId: prog.id, name: "2025 Scheme", year: 2025 },
  });

  // Subjects
  const subj = await prisma.subject.create({
    data: { subjectCode: "OS101", subjectName: "Operating Systems", credits: 4, questionBankDueDate: new Date("2027-08-15"), departmentId: dept.id },
  });

  // Subject Version
  const sv = await prisma.subjectVersion.create({
    data: { subjectId: subj.id, versionNumber: 1, title: subj.subjectName, effectiveFromAcademicYearId: ay.id, status: "ACTIVE" },
  });

  // Curriculum Subject
  await prisma.curriculumSubject.create({
    data: { curriculumSchemeId: scheme.id, subjectId: subj.id, semesterNumber: 5, academicUnitId: compUnit.id, groupAssignment: "ALL" },
  });

  // Batch
  const batch = await prisma.batch.create({
    data: { name: "BE Computer 2025-29", code: "BECOMP2025", programmeId: prog.id, curriculumSchemeId: scheme.id, admissionYear: 2025, graduationYear: 2029 },
  });

  // Batch Semesters
  for (let sem = 1; sem <= 8; sem++) {
    const isFirstYear = sem <= 2;
    const academicYearCode = `${2025 + Math.floor((sem - 1) / 2)}-${2025 + Math.floor((sem - 1) / 2) + 1}`;
    const academicYear = await prisma.academicYear.findUnique({ where: { code: academicYearCode } })
      ?? await prisma.academicYear.create({ data: { code: academicYearCode, startDate: new Date(`${2025 + Math.floor((sem - 1) / 2)}-06-01`), endDate: new Date(`${2025 + Math.floor((sem - 1) / 2) + 1}-05-31`), status: sem <= 2 ? "ACTIVE" : "CLOSED" } });
    await prisma.batchSemester.create({
      data: { batchId: batch.id, semesterNumber: sem, academicYearId: academicYear.id, academicUnitId: isFirstYear ? eshUnit.id : compUnit.id, startDate: null, endDate: null, status: sem === 1 ? "ACTIVE" : "UPCOMING" },
    });
  }

  console.log("Seed complete");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
