import {
  AssignmentRole,
  CourseOutcome,
  DifficultyLevel,
  ExamCycleStatus,
  ExamType,
  NotificationType,
  QuestionBankStatus,
  QuestionStatus,
  RbtLevel,
  Role,
  UserStatus,
  PrismaClient,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildQuestionSlotTemplate } from "../src/modules/questions/slot-template";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 12);

  const cse = await prisma.department.upsert({
    where: { code: "CSE" },
    update: {},
    create: { name: "Computer Science", code: "CSE", hodName: "Dr. Anita Rao" },
  });

  const ece = await prisma.department.upsert({
    where: { code: "ECE" },
    update: {},
    create: { name: "Electronics", code: "ECE", hodName: "Dr. Mahesh Gupta" },
  });

  const users = await Promise.all(
    [
      ["Controller of Examination", "coe@emqpgs.local", Role.COE, cse.id],
      ["Coordinator Jane", "coordinator@emqpgs.local", Role.COORDINATOR, cse.id],
      ["Moderator Arun", "moderator@emqpgs.local", Role.MODERATOR, cse.id],
      ["Contributor Meera", "contributor@emqpgs.local", Role.CONTRIBUTOR, ece.id],
      ["Dean Priya", "dean@emqpgs.local", Role.DEAN, cse.id],
    ].map(([name, email, role, departmentId]) =>
      prisma.user.upsert({
        where: { email: email as string },
        update: {},
        create: {
          name: name as string,
          email: email as string,
          role: role as Role,
          departmentId: departmentId as string,
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      }),
    ),
  );

  const examCycle = await prisma.examCycle.upsert({
    where: {
      academicYear_semester_examType: {
        academicYear: "2026-2027",
        semester: 5,
        examType: ExamType.ENDSEM,
      },
    },
    update: {},
    create: {
      academicYear: "2026-2027",
      semester: 5,
      examType: ExamType.ENDSEM,
      status: ExamCycleStatus.ACTIVE,
      departmentId: cse.id,
    },
  });

  const subject = await prisma.subject.upsert({
    where: { subjectCode: "CS501" },
    update: {},
    create: {
      subjectCode: "CS501",
      subjectName: "Advanced Algorithms",
      academicYear: "2026-2027",
      semester: 5,
      credits: 4,
      questionBankDueDate: new Date("2026-08-15T00:00:00.000Z"),
      departmentId: cse.id,
    },
  });

  const questionBank = await prisma.questionBank.upsert({
    where: {
      subjectId_examCycleId: {
        subjectId: subject.id,
        examCycleId: examCycle.id,
      },
    },
    update: {},
    create: {
      subjectId: subject.id,
      examCycleId: examCycle.id,
      status: QuestionBankStatus.IN_PROGRESS,
      createdById: users[1].id,
    },
  });

  await prisma.teacherAssignment.upsert({
    where: {
      questionBankId_teacherId_assignmentRole: {
        questionBankId: questionBank.id,
        teacherId: users[2].id,
        assignmentRole: AssignmentRole.MODERATOR,
      },
    },
    update: {},
    create: {
      questionBankId: questionBank.id,
      teacherId: users[2].id,
      assignmentRole: AssignmentRole.MODERATOR,
      assignedById: users[1].id,
    },
  });

  await prisma.teacherAssignment.upsert({
    where: {
      questionBankId_teacherId_assignmentRole: {
        questionBankId: questionBank.id,
        teacherId: users[3].id,
        assignmentRole: AssignmentRole.CONTRIBUTOR,
      },
    },
    update: {},
    create: {
      questionBankId: questionBank.id,
      teacherId: users[3].id,
      assignmentRole: AssignmentRole.CONTRIBUTOR,
      assignedById: users[1].id,
    },
  });

  await prisma.notification.create({
    data: {
      recipientId: users[3].id,
      title: "Question bank contribution assigned",
      message: "You have been assigned as contributor for CS501.",
      type: NotificationType.ACTION_REQUIRED,
      actionUrl: "/dashboard/contributor",
    },
  });

  await prisma.questionSlot.createMany({
    data: buildQuestionSlotTemplate().map((slot) => ({
      questionBankId: questionBank.id,
      ...slot,
    })),
    skipDuplicates: true,
  });

  const reservedSlot = await prisma.questionSlot.findFirst({
    where: {
      questionBankId: questionBank.id,
      moduleNumber: 1,
      marks: 5,
      slotNumber: 1,
    },
  });

  if (reservedSlot) {
    await prisma.questionSlot.update({
      where: { id: reservedSlot.id },
      data: {
        reservedById: users[3].id,
        reservedAt: new Date(),
        isLocked: true,
      },
    });

    const question = await prisma.question.upsert({
      where: { slotId: reservedSlot.id },
      update: {},
      create: {
        questionBankId: questionBank.id,
        slotId: reservedSlot.id,
        questionText: "Analyze the time complexity of Dijkstra's algorithm with a binary heap.",
        moduleNumber: 1,
        marks: 5,
        slotNumber: 1,
        coMapping: CourseOutcome.CO2,
        rbtLevel: RbtLevel.L4,
        teachingIndex: "TI-ALG-01",
        difficultyLevel: DifficultyLevel.MEDIUM,
        contributorId: users[3].id,
        status: QuestionStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    void question;
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
