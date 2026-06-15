// Creates a fresh bank, fills all 126 slots with PENDING questions
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

try {
  // Check for existing DRAFTING bank — if exists, skip creation
  const existing = await prisma.questionBank.findFirst({ where: { phase: 'DRAFTING', recordStatus: 'ACTIVE' } });
  if (existing) {
    console.log(`DRAFTING bank exists: ${existing.id}`);
    const dCount = await prisma.questionSlot.count({ where: { questionBankId: existing.id, assignedQuestionId: { not: null } } });
    console.log(`${dCount}/126 slots filled`);
    if (dCount === 126) { console.log('Already full'); await prisma.$disconnect(); process.exit(0); }
  }

  // Use seed data: find subject WITHOUT a bank in this cycle, or create one
  const cycle = await prisma.examCycle.findFirst();
  if (!cycle) { console.log('No cycle'); await prisma.$disconnect(); process.exit(1); }
  const dept = await prisma.department.findFirst({ where: { code: 'CSE' } });
  const sem = await prisma.semester.findFirst({ where: { number: 5 } });
  const contrib = await prisma.user.findFirst({ where: { role: 'CONTRIBUTOR' } });
  if (!contrib) { console.log('No contributor'); await prisma.$disconnect(); process.exit(1); }
  const coord = await prisma.coordinatorDepartmentAssignment.findFirst({ include: { coordinator: true } });
  const userId = coord?.coordinator?.id || contrib.id;

  // Find or create subject without a bank for this cycle
  let subj = await prisma.subject.findFirst({
    where: { questionBanks: { none: { examCycleId: cycle.id } } },
    include: { versions: true }
  });
  if (!subj) {
    const code = 'FS' + Date.now().toString(36).slice(-4).toUpperCase();
    subj = await prisma.subject.create({
      data: {
        subjectCode: code, subjectName: 'Fresh Seed Subject', credits: 4,
        departmentId: dept.id, semesterId: sem.id,
        status: 'ACTIVE', createdById: userId,
      },
      include: { versions: true }
    });
    // Create version
    const ay = await prisma.academicYear.findFirst();
    await prisma.subjectVersion.create({
      data: {
        subjectId: subj.id, versionNumber: 1, title: subj.subjectName,
        syllabusDescription: 'Syllabus', effectiveFromAcademicYearId: ay.id, status: 'ACTIVE',
      }
    });
    // Link to cycle
    await prisma.examCycleLink.create({
      data: { subjectId: subj.id, examCycleId: cycle.id }
    });
    subj = await prisma.subject.findUnique({ where: { id: subj.id }, include: { versions: true } });
    console.log(`Created subject: ${code}`);
  }
  const verId = subj.versions[0]?.id;
  const contributor = contrib;

  // Create bank (unique per subject+cycle)
  const bank = await prisma.questionBank.create({
    data: {
      subjectId: subj.id,
      examCycleId: cycle.id,
      phase: 'DRAFTING',
      recordStatus: 'ACTIVE',
      createdById: userId,
    }
  });
  console.log(`Created bank: ${bank.id}`);

  // Create paper pattern
  await prisma.paperPattern.create({
    data: {
      questionBankId: bank.id,
      examType: 'ENDSEM',
      totalModules: 6,
      marksPattern: [2, 5, 10],
      slotsPerModule: 7,
      totalSlots: 126,
    }
  });

  // Create 126 slots
  const slotData = [];
  for (let m = 1; m <= 6; m++) {
    for (const mk of [2, 5, 10]) {
      for (let s = 1; s <= 7; s++) {
        slotData.push({ questionBankId: bank.id, moduleNumber: m, marks: mk, slotNumber: s });
      }
    }
  }
  await prisma.questionSlot.createMany({ data: slotData });
  console.log('Created 126 slots');

  // Fill all slots with PENDING questions
  const slots = await prisma.questionSlot.findMany({ where: { questionBankId: bank.id, assignedQuestionId: null } });
  const rbtLevels = ['L1','L2','L3','L4','L5','L6'];
  const cos = ['CO1','CO2','CO3','CO4','CO5','CO6'];
  let count = 0;

  for (const slot of slots) {
    const rbt = rbtLevels[count % 6];
    const co = cos[count % 6];
    const question = await prisma.questionLibraryItem.create({
      data: {
        subjectVersionId: verId,
        moduleNumber: slot.moduleNumber,
        marks: slot.marks,
        questionText: `Bank ${bank.id.slice(-4)} M${slot.moduleNumber} ${slot.marks}-mark Q${slot.slotNumber}: Explain ${rbt} for ${co} with examples.`,
        coMapping: co,
        rbtLevel: rbt,
        createdById: contributor.id,
        ownerId: contributor.id,
        status: 'PENDING',
        submittedAt: new Date(),
      }
    });
    await prisma.questionSlot.update({
      where: { id: slot.id },
      data: { assignedQuestionId: question.id }
    });
    count++;
  }

  const filled = await prisma.questionSlot.count({ where: { questionBankId: bank.id, assignedQuestionId: { not: null } } });
  console.log(`Filled ${filled}/126 slots with PENDING questions`);
  console.log(`Bank ID: ${bank.id}`);
  await prisma.$disconnect();
} catch(e) { console.error(e); await prisma.$disconnect(); process.exit(1); }
