import { PrismaClient, Role, ExamType, ExamCycleStatus, UserStatus, SubjectStatus, BatchStatus, BatchSemesterStatus, AcademicYearStatus, GroupAssignment } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

function dt(y: number, m: number, d: number) {
  return new Date(y, m - 1, d);
}

async function main() {
  console.log("Seeding TCET structure — 2 departments, 2 batches, real faculty, FE groups...");
  const pwh = await bcrypt.hash(PASSWORD, 12);

  // ──────────────────────────────────────────────
  // 1. DEPARTMENTS
  // ──────────────────────────────────────────────
  const comp = await prisma.department.upsert({
    where: { code: "COMP" },
    update: {},
    create: { name: "Computer Engineering", code: "COMP", hodName: "Dr. Harshali P. Patil" },
  });

  const extc = await prisma.department.upsert({
    where: { code: "EXTC" },
    update: {},
    create: { name: "Electronics & Telecommunication Engineering", code: "EXTC", hodName: "Dr. Vinitkumar Dongre" },
  });

  const hns = await prisma.department.upsert({
    where: { code: "HNS" },
    update: {},
    create: { name: "Humanities & Sciences", code: "HNS", hodName: "Dr. Sunita Pachori" },
  });

  // ──────────────────────────────────────────────
  // 2. CURRICULUM SCHEMES
  // ──────────────────────────────────────────────
  const compScheme = await prisma.curriculumScheme.create({
    data: { departmentId: comp.id, name: "CBCGS-H 2019 (COMP)", year: 2024, durationSemesters: 8 },
  });

  const extcScheme = await prisma.curriculumScheme.create({
    data: { departmentId: extc.id, name: "CBCGS-H 2019 (EXTC)", year: 2024, durationSemesters: 8 },
  });

  // ──────────────────────────────────────────────
  // 3. ACADEMIC YEARS
  // ──────────────────────────────────────────────
  const ay2425 = await prisma.academicYear.create({
    data: { code: "2024-2025", startDate: dt(2024, 6, 1), endDate: dt(2025, 5, 31), status: AcademicYearStatus.CLOSED },
  });

  const ay2526 = await prisma.academicYear.create({
    data: { code: "2025-2026", startDate: dt(2025, 6, 1), endDate: dt(2026, 5, 31), status: AcademicYearStatus.CLOSED },
  });

  const ay2627 = await prisma.academicYear.create({
    data: { code: "2026-2027", startDate: dt(2026, 6, 1), endDate: dt(2027, 5, 31), status: AcademicYearStatus.ACTIVE },
  });

  // ──────────────────────────────────────────────
  // 4. ALL SUBJECTS (FE + SE/TE)
  // ──────────────────────────────────────────────
  type SubjectDef = { code: string; name: string; credits: number; semesters: { num: number; group: GroupAssignment }[] };

  const ALL_SUBJECTS: SubjectDef[] = [
    // ── FE Sem I (common + group split) ──
    { code: "BSC103", name: "Mathematics I", credits: 5, semesters: [{ num: 1, group: GroupAssignment.ALL }] },
    { code: "BSC101", name: "Physics", credits: 4, semesters: [{ num: 1, group: GroupAssignment.GROUP_1 }] },
    { code: "ESC101", name: "Basic Electrical Engineering", credits: 4, semesters: [{ num: 1, group: GroupAssignment.GROUP_1 }] },
    { code: "ESC104", name: "Engineering Mechanics", credits: 4, semesters: [{ num: 1, group: GroupAssignment.GROUP_1 }] },
    { code: "BSC102", name: "Chemistry", credits: 4, semesters: [{ num: 1, group: GroupAssignment.GROUP_2 }] },
    { code: "ESC103", name: "Programming for Problem Solving", credits: 4, semesters: [{ num: 1, group: GroupAssignment.GROUP_2 }] },
    { code: "ESC102", name: "Engineering Graphics & Design", credits: 4, semesters: [{ num: 1, group: GroupAssignment.GROUP_2 }] },
    { code: "ESC105", name: "Workshop/Manufacturing Practices I", credits: 2, semesters: [{ num: 1, group: GroupAssignment.ALL }] },

    // ── FE Sem II (common + group split) ──
    { code: "BSC104", name: "Mathematics II", credits: 5, semesters: [{ num: 2, group: GroupAssignment.ALL }] },
    { code: "HSMC101", name: "Communication Skills", credits: 3, semesters: [{ num: 2, group: GroupAssignment.ALL }] },
    { code: "BSC102", name: "Chemistry", credits: 4, semesters: [{ num: 2, group: GroupAssignment.GROUP_1 }] },
    { code: "ESC103", name: "Programming for Problem Solving", credits: 4, semesters: [{ num: 2, group: GroupAssignment.GROUP_1 }] },
    { code: "ESC102", name: "Engineering Graphics & Design", credits: 4, semesters: [{ num: 2, group: GroupAssignment.GROUP_1 }] },
    { code: "BSC101", name: "Physics", credits: 4, semesters: [{ num: 2, group: GroupAssignment.GROUP_2 }] },
    { code: "ESC101", name: "Basic Electrical Engineering", credits: 4, semesters: [{ num: 2, group: GroupAssignment.GROUP_2 }] },
    { code: "ESC104", name: "Engineering Mechanics", credits: 4, semesters: [{ num: 2, group: GroupAssignment.GROUP_2 }] },
    { code: "ESC105", name: "Workshop/Manufacturing Practices II", credits: 2, semesters: [{ num: 2, group: GroupAssignment.ALL }] },

    // ── COMP Sem III (SE) ──
    { code: "HSMC-301", name: "Universal Human Values-II", credits: 3, semesters: [{ num: 3, group: GroupAssignment.ALL }] },
    { code: "BSC-COMP-301", name: "Mathematics-III", credits: 4, semesters: [{ num: 3, group: GroupAssignment.ALL }] },
    { code: "ESC-COMP-301", name: "Digital Logic Design & Computer Architecture", credits: 4, semesters: [{ num: 3, group: GroupAssignment.ALL }] },
    { code: "PCC-COMP-302", name: "Database Management System", credits: 4, semesters: [{ num: 3, group: GroupAssignment.ALL }] },
    { code: "PCC-COMP-303", name: "Data Structure using JAVA", credits: 5, semesters: [{ num: 3, group: GroupAssignment.ALL }] },

    // ── COMP Sem IV (SE) ──
    { code: "BSC-COMP-401", name: "Mathematics-IV", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },
    { code: "PCC-COMP-401", name: "Design and Analysis of Algorithm using Python", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },
    { code: "PCC-COMP-402", name: "Operating System", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },
    { code: "PCC-COMP-403", name: "Computer Networks", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },

    // ── COMP Sem V (TE) ──
    { code: "HSMC-501", name: "Soft Skill & Interpersonal Communication", credits: 3, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
    { code: "ESC-COMP-501", name: "Computer Graphics", credits: 4, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
    { code: "PCC-COMP-501", name: "Theory of Computation", credits: 4, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
    { code: "PCC-COMP-502", name: "Introduction to Intelligent Systems", credits: 4, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
    { code: "PCC-COMP-503", name: "Microprocessor", credits: 4, semesters: [{ num: 5, group: GroupAssignment.ALL }] },

    // ── EXTC Sem III (SE) ──
    { code: "BSC-EXTC-301", name: "Engineering Mathematics III", credits: 4, semesters: [{ num: 3, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-301", name: "Electronic Devices & Circuits", credits: 4, semesters: [{ num: 3, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-302", name: "Digital System Design", credits: 4, semesters: [{ num: 3, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-303", name: "Network Theory", credits: 4, semesters: [{ num: 3, group: GroupAssignment.ALL }] },
    { code: "ESC-EXTC-301", name: "Object Oriented Programming", credits: 4, semesters: [{ num: 3, group: GroupAssignment.ALL }] },

    // ── EXTC Sem IV (SE) ──
    { code: "BSC-EXTC-401", name: "Engineering Mathematics IV", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-401", name: "Signals & Systems", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-402", name: "Analog Communication", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-403", name: "Microprocessors & Microcontrollers", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-404", name: "Control Systems", credits: 4, semesters: [{ num: 4, group: GroupAssignment.ALL }] },

    // ── EXTC Sem V (TE) ──
    { code: "PCC-EXTC-501", name: "Digital Communication", credits: 4, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-502", name: "Electromagnetic Engineering", credits: 4, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-503", name: "VLSI Design", credits: 4, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
    { code: "PCC-EXTC-504", name: "Computer Networks", credits: 4, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
    { code: "HSMC-EXTC-501", name: "Soft Skills & Interpersonal Communication", credits: 3, semesters: [{ num: 5, group: GroupAssignment.ALL }] },
  ];

  const subjectMap = new Map<string, string>();

  async function createSubjects() {
    for (const sd of ALL_SUBJECTS) {
      // FE subjects (BSC/ESC codes without dept prefix) → HNS
      // COMP subjects → COMP, EXTC subjects → EXTC
      const deptId = sd.code.includes("COMP") ? comp.id : sd.code.includes("EXTC") ? extc.id : hns.id;

      const s = await prisma.subject.upsert({
        where: { subjectCode_departmentId: { subjectCode: sd.code, departmentId: deptId } },
        update: {},
        create: {
          subjectCode: sd.code, subjectName: sd.name, credits: sd.credits,
          questionBankDueDate: dt(2026, 12, 15), departmentId: deptId, status: SubjectStatus.ACTIVE,
        },
      });
      subjectMap.set(sd.code, s.id);

      await prisma.subjectVersion.create({
        data: { subjectId: s.id, versionNumber: 1, title: sd.name, effectiveFromAcademicYearId: ay2425.id },
      });
    }
  }
  await createSubjects();

  // Curriculum subjects – link subjects to each scheme with proper group + offering department
  async function mapToScheme(schemeId: string, filterGroup: GroupAssignment) {
    for (const sd of ALL_SUBJECTS) {
      for (const sem of sd.semesters) {
        if (sem.group === GroupAssignment.ALL || sem.group === filterGroup) {
          const subjId = subjectMap.get(sd.code);
          if (!subjId) continue;
          const offeringDept = sd.code.includes("COMP") ? comp.id : sd.code.includes("EXTC") ? extc.id : hns.id;
          await prisma.curriculumSubject.upsert({
            where: {
              curriculumSchemeId_subjectId_semesterNumber_groupAssignment: {
                curriculumSchemeId: schemeId, subjectId: subjId, semesterNumber: sem.num, groupAssignment: sem.group,
              },
            },
            update: {},
            create: {
              curriculumSchemeId: schemeId, subjectId: subjId, semesterNumber: sem.num,
              departmentId: offeringDept, groupAssignment: sem.group,
            },
          });
        }
      }
    }
  }

  // COMP → Group 1, EXTC → Group 2
  await mapToScheme(compScheme.id, GroupAssignment.GROUP_1);
  await mapToScheme(extcScheme.id, GroupAssignment.GROUP_2);

  // ──────────────────────────────────────────────
  // 5. USERS — real TCET faculty
  // ──────────────────────────────────────────────
  const FACULTY = [
    // COMP (tcet.md §5.1)
    { name: "Dr. R.R. Sedamkar", email: "coe@emqpgs.local", role: Role.COE, dept: comp.id },
    { name: "Dr. Sheetal Rathi", email: "dean@emqpgs.local", role: Role.DEAN, dept: comp.id },
    { name: "Dr. Harshali P. Patil", email: "coordinator.comp@emqpgs.local", role: Role.COORDINATOR, dept: comp.id },
    { name: "Dr. Megharani Patil", email: "moderator.comp1@emqpgs.local", role: Role.MODERATOR, dept: comp.id },
    { name: "Dr. Rekha Sharma", email: "moderator.comp2@emqpgs.local", role: Role.MODERATOR, dept: comp.id },
    { name: "Dr. Rashmi Thakur", email: "moderator.comp3@emqpgs.local", role: Role.MODERATOR, dept: comp.id },
    { name: "Dr. Preksha Pareek", email: "contributor1.comp@emqpgs.local", role: Role.CONTRIBUTOR, dept: comp.id },
    { name: "Dr. Vaishali Nirgude", email: "contributor2.comp@emqpgs.local", role: Role.CONTRIBUTOR, dept: comp.id },
    { name: "Mr. Vikas Singh", email: "contributor3.comp@emqpgs.local", role: Role.CONTRIBUTOR, dept: comp.id },
    { name: "Mrs. Lydia Suganya", email: "contributor4.comp@emqpgs.local", role: Role.CONTRIBUTOR, dept: comp.id },
    // EXTC (tcet.md §5.4)
    { name: "Dr. Vinitkumar Dongre", email: "coordinator.extc@emqpgs.local", role: Role.COORDINATOR, dept: extc.id },
    { name: "Dr. Lochan Jolly", email: "moderator.extc1@emqpgs.local", role: Role.MODERATOR, dept: extc.id },
    { name: "Mr. Sanjeev Ghosh", email: "moderator.extc2@emqpgs.local", role: Role.MODERATOR, dept: extc.id },
    { name: "Dr. Sujata Kulkarni", email: "contributor1.extc@emqpgs.local", role: Role.CONTRIBUTOR, dept: extc.id },
    // HNS (tcet.md §5.3)
    { name: "Dr. Sunita Pachori", email: "coordinator.hns@emqpgs.local", role: Role.COORDINATOR, dept: hns.id },
    { name: "Dr. Rohit Kumar Singh", email: "moderator.hns1@emqpgs.local", role: Role.MODERATOR, dept: hns.id },
    { name: "Dr. Ashwin Pathak", email: "contributor1.hns@emqpgs.local", role: Role.CONTRIBUTOR, dept: hns.id },
  ];

  for (const f of FACULTY) {
    await prisma.user.create({
      data: { name: f.name, email: f.email, role: f.role, passwordHash: pwh, status: UserStatus.ACTIVE, departmentId: f.dept },
    });
  }

  // ──────────────────────────────────────────────
  // 6. COORDINATOR → DEPARTMENT assignments
  // ──────────────────────────────────────────────
  for (const [email, deptId] of [
    ["coordinator.comp@emqpgs.local", comp.id],
    ["coordinator.extc@emqpgs.local", extc.id],
    ["coordinator.hns@emqpgs.local", hns.id],
  ] as const) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) await prisma.coordinatorDepartmentAssignment.create({ data: { coordinatorId: user.id, departmentId: deptId } });
  }

  // ──────────────────────────────────────────────
  // 7. BATCHES — 2 (1 per department)
  // ──────────────────────────────────────────────
  const compBatch = await prisma.batch.create({
    data: {
      name: "BE Computer 2024-28", code: "BECOMP2024", departmentId: comp.id,
      curriculumSchemeId: compScheme.id, admissionYear: 2024, graduationYear: 2028,
      status: BatchStatus.ACTIVE, hasTeachingGroups: true,
      teachingGroups: { create: [{ groupNumber: 1, name: "Physics Group (COMP)" }] },
    },
  });

  const extcBatch = await prisma.batch.create({
    data: {
      name: "BE EXTC 2024-28", code: "BEEXTC2024", departmentId: extc.id,
      curriculumSchemeId: extcScheme.id, admissionYear: 2024, graduationYear: 2028,
      status: BatchStatus.ACTIVE, hasTeachingGroups: true,
      teachingGroups: { create: [{ groupNumber: 2, name: "Chemistry Group (EXTC)" }] },
    },
  });

  // ──────────────────────────────────────────────
  // 8. BATCH SEMESTERS (Sem I → V)
  // ──────────────────────────────────────────────
  const BATCH_SEMESTERS: {
    batchId: string; sem: number; ayId: string; deptId: string; status: BatchSemesterStatus; start: Date; end: Date;
  }[] = [
    // COMP: FE → SE → TE
    { batchId: compBatch.id, sem: 1, ayId: ay2425.id, deptId: comp.id, status: BatchSemesterStatus.COMPLETED, start: dt(2024, 7, 14), end: dt(2024, 12, 20) },
    { batchId: compBatch.id, sem: 2, ayId: ay2425.id, deptId: comp.id, status: BatchSemesterStatus.COMPLETED, start: dt(2025, 1, 5), end: dt(2025, 6, 15) },
    { batchId: compBatch.id, sem: 3, ayId: ay2526.id, deptId: comp.id, status: BatchSemesterStatus.COMPLETED, start: dt(2025, 7, 14), end: dt(2025, 12, 20) },
    { batchId: compBatch.id, sem: 4, ayId: ay2526.id, deptId: comp.id, status: BatchSemesterStatus.COMPLETED, start: dt(2026, 1, 5), end: dt(2026, 6, 15) },
    { batchId: compBatch.id, sem: 5, ayId: ay2627.id, deptId: comp.id, status: BatchSemesterStatus.ACTIVE, start: dt(2026, 7, 14), end: dt(2026, 12, 20) },
    // EXTC: FE → SE → TE
    { batchId: extcBatch.id, sem: 1, ayId: ay2425.id, deptId: extc.id, status: BatchSemesterStatus.COMPLETED, start: dt(2024, 7, 14), end: dt(2024, 12, 20) },
    { batchId: extcBatch.id, sem: 2, ayId: ay2425.id, deptId: extc.id, status: BatchSemesterStatus.COMPLETED, start: dt(2025, 1, 5), end: dt(2025, 6, 15) },
    { batchId: extcBatch.id, sem: 3, ayId: ay2526.id, deptId: extc.id, status: BatchSemesterStatus.COMPLETED, start: dt(2025, 7, 14), end: dt(2025, 12, 20) },
    { batchId: extcBatch.id, sem: 4, ayId: ay2526.id, deptId: extc.id, status: BatchSemesterStatus.COMPLETED, start: dt(2026, 1, 5), end: dt(2026, 6, 15) },
    { batchId: extcBatch.id, sem: 5, ayId: ay2627.id, deptId: extc.id, status: BatchSemesterStatus.ACTIVE, start: dt(2026, 7, 14), end: dt(2026, 12, 20) },
  ];

  const batchSemesterMap = new Map<string, string>();

  for (const bd of BATCH_SEMESTERS) {
    const bs = await prisma.batchSemester.create({
      data: {
        batchId: bd.batchId, semesterNumber: bd.sem, academicYearId: bd.ayId,
        departmentId: bd.deptId, startDate: bd.start, endDate: bd.end, status: bd.status,
      },
    });
    batchSemesterMap.set(`${bd.batchId}_sem${bd.sem}`, bs.id);
  }

  await prisma.batch.update({
    where: { id: compBatch.id },
    data: { currentSemesterNumber: 5, currentBatchSemesterId: batchSemesterMap.get(`${compBatch.id}_sem5`) },
  });
  await prisma.batch.update({
    where: { id: extcBatch.id },
    data: { currentSemesterNumber: 5, currentBatchSemesterId: batchSemesterMap.get(`${extcBatch.id}_sem5`) },
  });

  // ──────────────────────────────────────────────
  // 9. EXAM CYCLES (structural only — no banks)
  // ──────────────────────────────────────────────
  const subjectsBySem: Record<number, string[]> = {
    1: ["BSC103", "BSC101", "ESC101", "ESC104", "BSC102", "ESC103", "ESC102", "ESC105"],
    2: ["BSC104", "HSMC101", "BSC102", "ESC103", "ESC102", "BSC101", "ESC101", "ESC104", "ESC105"],
    3: ["HSMC-301", "BSC-COMP-301", "ESC-COMP-301", "PCC-COMP-302", "PCC-COMP-303",
        "BSC-EXTC-301", "PCC-EXTC-301", "PCC-EXTC-302", "PCC-EXTC-303", "ESC-EXTC-301"],
    4: ["BSC-COMP-401", "PCC-COMP-401", "PCC-COMP-402", "PCC-COMP-403",
        "BSC-EXTC-401", "PCC-EXTC-401", "PCC-EXTC-402", "PCC-EXTC-403", "PCC-EXTC-404"],
    5: ["HSMC-501", "ESC-COMP-501", "PCC-COMP-501", "PCC-COMP-502", "PCC-COMP-503",
        "PCC-EXTC-501", "PCC-EXTC-502", "PCC-EXTC-503", "PCC-EXTC-504", "HSMC-EXTC-501"],
  };

  for (const bd of BATCH_SEMESTERS) {
    const bsId = batchSemesterMap.get(`${bd.batchId}_sem${bd.sem}`)!;
    const ecStatus = bd.status === BatchSemesterStatus.COMPLETED ? ExamCycleStatus.CLOSED : ExamCycleStatus.ACTIVE;

    for (const examType of [ExamType.ISE_1, ExamType.ISE_2, ExamType.ENDSEM] as const) {
      const ec = await prisma.examCycle.create({
        data: { examType, status: ecStatus, version: 1, batchSemesterId: bsId },
      });

      for (const subjCode of subjectsBySem[bd.sem] || []) {
        const subjId = subjectMap.get(subjCode);
        if (subjId) {
          await prisma.subjectExamCycleLink.create({ data: { subjectId: subjId, examCycleId: ec.id } }).catch(() => {});
        }
      }
    }
  }

  // ──────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("SEED COMPLETE — STRUCTURE ONLY");
  console.log("═══════════════════════════════════════════");
  console.log(`   Departments:     3 (COMP, EXTC, HNS)`);
  console.log(`   Schemes:         2 (COMP, EXTC)`);
  console.log(`   Academic Years:  3`);
  console.log(`   Subjects:        ${ALL_SUBJECTS.length}`);
  console.log(`   Users:           ${FACULTY.length} (real TCET names)`);
  console.log(`   Batches:         2 (COMP 2024-28, EXTC 2024-28)`);
  console.log(`   Teaching Groups: COMP→Group 1, EXTC→Group 2`);
  console.log(`   Exam Cycles:     30 (3 per batch-sem × 10)`);

  console.log("\n   FE group structure:");
  console.log("     Common (ALL): Math I, Math II, Communication Skills, Workshop");
  console.log("     Group 1 (COMP): Sem I→Physics, Basic Elec, Engg Mech; Sem II→Chemistry, Programming, Graphics");
  console.log("     Group 2 (EXTC): Sem I→Chemistry, Programming, Graphics; Sem II→Physics, Basic Elec, Engg Mech");

  console.log("\n   Real TCET faculty assigned:");
  console.log("     COMP: Dr. Sedamkar (COE), Dr. Sheetal Rathi (Dean), Dr. Harshali Patil (Coord/HOD), +7");
  console.log("     EXTC: Dr. Vinitkumar Dongre (Coord/HOD), Dr. Lochan Jolly, Mr. Sanjeev Ghosh, Dr. Sujata Kulkarni");
  console.log("     HNS:  Dr. Sunita Pachori (Coord/HOD), Dr. Rohit Kumar Singh, Dr. Ashwin Pathak");

  console.log("\n📧 All passwords: Password@123");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
