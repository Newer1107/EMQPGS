// Direct DB seed: fill remaining 125 slots with questions
// Run ONCE before the e2e workflow test
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const bank = await prisma.questionBank.findFirst({ where: { phase: 'DRAFTING', recordStatus: 'ACTIVE' } });
  if (!bank) { console.log('No DRAFTING bank found'); return; }

  const ver = await prisma.subjectVersion.findFirst({ where: { subjectId: bank.subjectId } });
  if (!ver) { console.log('No subject version found'); return; }

  const contributor = await prisma.user.findFirst({ where: { role: 'CONTRIBUTOR' } });
  if (!contributor) { console.log('No contributor found'); return; }

  const slots = await prisma.questionSlot.findMany({
    where: { questionBankId: bank.id, assignedQuestionId: null }
  });

  console.log(`Bank: ${bank.id}, Slots to fill: ${slots.length}`);

  const rbtLevels = ['L1','L2','L3','L4','L5','L6'];
  const cos = ['CO1','CO2','CO3','CO4','CO5','CO6'];
  let count = 0;

  for (const slot of slots) {
    const rbt = rbtLevels[count % 6];
    const co = cos[count % 6];
    
    const question = await prisma.questionLibraryItem.create({
      data: {
        subjectVersionId: ver.id,
        moduleNumber: slot.moduleNumber,
        marks: slot.marks,
        questionText: `Auto question M${slot.moduleNumber} ${slot.marks}-mark slot${slot.slotNumber}: Explain ${rbt} for ${co} with examples and algorithms.`,
        coMapping: co,
        rbtLevel: rbt,
        createdById: contributor.id,
        ownerId: contributor.id,
        status: 'PENDING',
      }
    });

    await prisma.questionSlot.update({
      where: { id: slot.id },
      data: { assignedQuestionId: question.id }
    });

    count++;
    if (count % 20 === 0) console.log(`  Filled ${count}/${slots.length}`);
  }

  const filled = await prisma.questionSlot.count({ where: { questionBankId: bank.id, assignedQuestionId: { not: null } } });
  console.log(`Total filled: ${filled}/126`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
