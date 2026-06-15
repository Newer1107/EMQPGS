import {
  AcademicYearStatus,
  CourseOutcome,
  DifficultyLevel,
  ExamCycleStatus,
  ExamType,
  NotificationType,
  QuestionBankPhase,
  QuestionStatus,
  RbtLevel,
  RecordStatus,
  Role,
  SubjectStatus,
  SubjectVersionStatus,
  UserStatus,
  PrismaClient,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 12);

  const cse = await prisma.department.upsert({
    where: { code: "CSE" }, update: {},
    create: { name: "Computer Science", code: "CSE", hodName: "Dr. Anita Rao" },
  });
  await prisma.department.upsert({
    where: { code: "ECE" }, update: {},
    create: { name: "Electronics", code: "ECE", hodName: "Dr. Mahesh Gupta" },
  });

  const users = await Promise.all([
    ["Controller of Examination", "coe@emqpgs.local", Role.COE, cse.id],
    ["Coordinator Jane", "coordinator@emqpgs.local", Role.COORDINATOR, cse.id],
    ["Moderator Arun", "moderator@emqpgs.local", Role.MODERATOR, cse.id],
    ["Contributor Meera", "contributor@emqpgs.local", Role.CONTRIBUTOR, cse.id],
    ["Dean Priya", "dean@emqpgs.local", Role.DEAN, cse.id],
  ].map(([name, email, role, deptId]) =>
    prisma.user.upsert({
      where: { email: email as string }, update: {},
      create: { name: name as string, email: email as string, role: role as Role, departmentId: deptId as string, passwordHash, status: UserStatus.ACTIVE },
    }),
  ));

  const ay = await prisma.academicYear.upsert({
    where: { code: "2026-2027" }, update: {},
    create: { code: "2026-2027", startDate: new Date("2026-06-01"), endDate: new Date("2027-05-31"), status: AcademicYearStatus.ACTIVE },
  });

  const sem5 = await prisma.semester.upsert({
    where: { academicYearId_number: { academicYearId: ay.id, number: 5 } }, update: {},
    create: { number: 5, name: "Semester V", academicYearId: ay.id },
  });

  const examCycle = await prisma.examCycle.upsert({
    where: { semesterId_examType: { semesterId: sem5.id, examType: ExamType.ENDSEM } }, update: {},
    create: { academicYearId: ay.id, semesterId: sem5.id, examType: ExamType.ENDSEM, status: ExamCycleStatus.ACTIVE, startDate: new Date("2026-11-01"), endDate: new Date("2026-11-30"), departmentId: cse.id },
  });

  const subject = await prisma.subject.upsert({
    where: { subjectCode_departmentId: { subjectCode: "CS501", departmentId: cse.id } }, update: {},
    create: { subjectCode: "CS501", subjectName: "Advanced Algorithms", credits: 4, status: SubjectStatus.ACTIVE, questionBankDueDate: new Date("2026-08-15"), departmentId: cse.id, semesterId: sem5.id },
  });

  const sv = await prisma.subjectVersion.upsert({
    where: { subjectId_versionNumber: { subjectId: subject.id, versionNumber: 1 } }, update: {},
    create: { subjectId: subject.id, versionNumber: 1, title: "Advanced Algorithms", syllabusDescription: "Algorithms and data structures.", effectiveFromAcademicYearId: ay.id, status: SubjectVersionStatus.ACTIVE },
  });

  await prisma.coordinatorDepartmentAssignment.upsert({
    where: { coordinatorId_departmentId: { coordinatorId: users[1].id, departmentId: cse.id } }, update: {},
    create: { coordinatorId: users[1].id, departmentId: cse.id },
  });
  await prisma.subjectExamCycleLink.upsert({
    where: { subjectId_examCycleId: { subjectId: subject.id, examCycleId: examCycle.id } }, update: {},
    create: { subjectId: subject.id, examCycleId: examCycle.id },
  });

  const questionBank = await prisma.questionBank.upsert({
    where: { subjectId_examCycleId: { subjectId: subject.id, examCycleId: examCycle.id } }, update: {},
    create: {
      subjectId: subject.id,
      examCycleId: examCycle.id,
      phase: QuestionBankPhase.DRAFTING,
      recordStatus: RecordStatus.ACTIVE,
      createdById: users[1].id,
    },
  });

  await prisma.paperPattern.upsert({
    where: { questionBankId: questionBank.id }, update: {},
    create: {
      questionBankId: questionBank.id,
      examType: ExamType.ENDSEM,
      totalModules: 6,
      marksPattern: [2, 5, 10],
      slotsPerModule: 7,
      totalSlots: 126,
    },
  });

  const slotData = [];
  for (let moduleNumber = 1; moduleNumber <= 6; moduleNumber += 1) {
    for (const marks of [2, 5, 10]) {
      for (let slotNumber = 1; slotNumber <= 7; slotNumber += 1) {
        slotData.push({ questionBankId: questionBank.id, moduleNumber, marks, slotNumber });
      }
    }
  }
  await prisma.questionSlot.createMany({ data: slotData, skipDuplicates: true });

  await prisma.moderatorBankAssignment.upsert({
    where: { moderatorId_questionBankId: { moderatorId: users[2].id, questionBankId: questionBank.id } }, update: {},
    create: { moderatorId: users[2].id, questionBankId: questionBank.id },
  });

  await prisma.notification.create({
    data: { recipientId: users[3].id, title: "Question bank contribution assigned", message: "You have been assigned as contributor for CS501.", type: NotificationType.ACTION_REQUIRED, actionUrl: "/dashboard/contributor" },
  });

  const question = await prisma.questionLibraryItem.create({
    data: {
      subjectVersionId: sv.id, moduleNumber: 1, marks: 5,
      questionText: "Analyze the time complexity of Dijkstra's algorithm with a binary heap.",
      coMapping: CourseOutcome.CO2, rbtLevel: RbtLevel.L4, difficultyLevel: DifficultyLevel.MEDIUM,
      teachingIndex: "TI-ALG-01", status: QuestionStatus.PENDING,
      createdById: users[3].id, ownerId: users[3].id, submittedAt: new Date(),
    },
  });

  await prisma.questionRevision.create({
    data: {
      questionId: question.id, revisionNumber: 1,
      snapshotQuestionText: question.questionText,
      snapshotModule: question.moduleNumber, snapshotMarks: question.marks,
      snapshotCo: question.coMapping, snapshotRbt: question.rbtLevel,
      snapshotDifficulty: question.difficultyLevel, snapshotTeachingIndex: question.teachingIndex,
      changedById: users[3].id, changeReason: "Initial creation",
    },
  });

  const targetSlot = await prisma.questionSlot.findFirst({
    where: { questionBankId: questionBank.id, moduleNumber: 1, marks: 5 },
  });
  if (targetSlot) {
    await prisma.questionSlot.update({
      where: { id: targetSlot.id },
      data: { assignedQuestionId: question.id },
    });
  }
}

main().then(async () => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
