// Set all DRAFT questions to PENDING so they can be moderated
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  // Find the DRAFTING bank
  const bank = await prisma.questionBank.findFirst({ where: { phase: 'DRAFTING', recordStatus: 'ACTIVE' } });
  if (!bank) { console.log('No DRAFTING bank'); process.exit(0); }

  // Get all slots for this bank with questions
  const slots = await prisma.questionSlot.findMany({
    where: { questionBankId: bank.id, assignedQuestionId: { not: null } },
    select: { assignedQuestionId: true }
  });
  const qIds = [...new Set(slots.map(s => s.assignedQuestionId).filter(Boolean))];
  console.log(`Found ${qIds.length} questions to update`);

  // Update status to PENDING
  const result = await prisma.questionLibraryItem.updateMany({
    where: { id: { in: qIds }, status: 'DRAFT' },
    data: { status: 'PENDING', submittedAt: new Date() }
  });
  console.log(`Updated ${result.count} questions to PENDING status`);

  await prisma.$disconnect();
} catch(e) { console.error(e); await prisma.$disconnect(); }
