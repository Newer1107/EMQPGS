import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const banks = await prisma.questionBank.findMany({
    select: { id: true, phase: true, recordStatus: true, _count: { select: { slots: true } } }
  });
  console.log(JSON.stringify(banks, null, 2));
} finally {
  await prisma.$disconnect();
}
