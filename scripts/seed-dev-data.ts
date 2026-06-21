import { PrismaClient, QuestionStatus, DifficultyLevel, RbtLevel, CourseOutcome } from "@prisma/client";

const prisma = new PrismaClient();

const DIFFICULTIES: DifficultyLevel[] = ["EASY", "MEDIUM", "HARD"];
const RBT_LEVELS: RbtLevel[] = ["L1", "L2", "L3", "L4", "L5", "L6"];
const COS: CourseOutcome[] = ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Q1: Record<string, string[]> = {
  1: [
    "Explain the functions of an operating system with suitable examples.",
    "What is a system call? Explain the types of system calls with examples.",
    "Describe the operating system structure with a diagram of layered approach.",
    "Compare monolithic kernel and microkernel architectures.",
    "Explain the role of an operating system in process management.",
    "What are the goals of an operating system? Discuss any four.",
    "Explain the different types of operating systems with examples.",
    "Describe the services provided by an operating system to users and programs.",
    "What is a system program? Differentiate between system programs and application programs.",
    "Explain the concept of virtual machines in operating systems.",
    "How does an operating system handle I/O operations? Explain with a diagram.",
    "Describe the components of a computer system and the role of the operating system.",
    "What is dual-mode operation in an operating system? Explain its significance.",
    "Explain the differences between interrupt-driven and polling-based I/O.",
    "Discuss the various design approaches for operating system kernels.",
    "How does an operating system manage memory? Give an overview.",
    "What is a process? Differentiate between process and program.",
    "Explain the concept of time-sharing systems with advantages and disadvantages.",
    "Describe the evolution of operating systems from batch processing to distributed systems.",
    "What is a system call interface? How does it facilitate communication between user and kernel?",
    "Explain the concept of traps and interrupts in the context of operating systems.",
  ],
  2: [
    "What is a process? Explain the process state diagram with all states.",
    "Describe the Process Control Block (PCB) and its components.",
    "Explain the concept of context switching with its overhead.",
    "Compare preemptive and non-preemptive scheduling algorithms.",
    "What is the FCFS scheduling algorithm? Solve an example with arrival times.",
    "Explain the Shortest Job First (SJF) scheduling with examples.",
    "Describe the Round Robin scheduling algorithm with a suitable example.",
    "What is priority scheduling? Explain the problem of starvation and its solution (aging).",
    "Explain the concept of multi-level queue scheduling.",
    "Describe the concept of threads and their benefits over processes.",
    "What is the difference between user-level threads and kernel-level threads?",
    "Explain the concept of multithreading models: many-to-one, one-to-one, and many-to-many.",
    "What are the various scheduling criteria used to evaluate CPU scheduling algorithms?",
    "Describe the concept of a dispatcher and its role in scheduling.",
    "How does the operating system handle the creation and termination of processes?",
    "Explain the concept of cooperating processes and inter-process communication.",
    "What is the producer-consumer problem? Describe its significance.",
    "Explain the difference between a thread and a process in terms of resource allocation.",
    "Describe the concept of CPU-bound and I/O-bound processes with their scheduling implications.",
    "What are the advantages of multithreading in a web server environment?",
    "Explain the concept of load balancing in multiprocessor scheduling.",
  ],
  3: [
    "What is a race condition? Explain with an example.",
    "Describe the critical section problem and its requirements.",
    "Explain Peterson's solution to the critical section problem.",
    "What is a semaphore? How does it solve synchronization problems?",
    "Describe the classic producer-consumer problem using semaphores.",
    "What is a mutex lock? Differentiate between mutex and semaphore.",
    "Explain the readers-writers problem and its solution.",
    "Describe the dining philosophers problem and its significance.",
    "What is deadlock? Explain the four necessary conditions for deadlock.",
    "Describe the deadlock prevention methods with respect to the four conditions.",
    "What is the banker's algorithm? Explain with an example.",
    "How does deadlock detection work in a system with multiple resources?",
    "Explain the difference between deadlock avoidance and deadlock prevention.",
    "Describe the concept of a resource allocation graph and how it identifies deadlocks.",
    "What is the difference between a deadlock and starvation?",
    "Explain the concept of a monitor and how it provides synchronization.",
    "Describe the bounded buffer problem and its solution.",
    "What is the purpose of the 'signal' operation in semaphores? Explain its semantics.",
    "How does the operating system recover from a deadlock once detected?",
    "Explain the concept of transaction memory as an alternative to traditional locking.",
    "Describe the openMP and pthreads approaches to parallel programming.",
  ],
  4: [
    "Explain the concept of logical and physical address spaces in memory management.",
    "Describe the difference between static and dynamic loading of programs.",
    "What is fragmentation? Explain internal and external fragmentation.",
    "Compare paging and segmentation in memory management.",
    "Explain the concept of a page table and its structure.",
    "What is a Translation Lookaside Buffer (TLB)? Explain its working.",
    "Describe the concept of demand paging and its advantages.",
    "What is a page fault? Explain the sequence of events when a page fault occurs.",
    "Describe the FIFO page replacement algorithm with an example.",
    "Explain the Optimal page replacement algorithm with a suitable example.",
    "What is the Least Recently Used (LRU) page replacement algorithm? Give an example.",
    "Describe the concept of thrashing and its causes.",
    "What is the working set model? How does it help control thrashing?",
    "Explain the concept of memory-mapped files and their advantages.",
    "Describe the buddy system for memory allocation.",
    "What is the difference between contiguous and non-contiguous memory allocation?",
    "Explain the concept of hierarchical paging with a two-level page table.",
    "Describe the concept of inverted page tables and their benefits.",
    "What is the page size selection trade-off in memory management?",
    "Explain the concept of copy-on-write in memory management.",
    "How does the operating system handle shared pages between multiple processes?",
  ],
  5: [
    "Explain the concept of a file and the various file attributes.",
    "Describe the different file access methods: sequential and direct.",
    "What is a directory structure? Explain with examples of single-level and two-level directories.",
    "Compare contiguous, linked, and indexed file allocation methods.",
    "Explain the concept of inodes in Unix/Linux file systems.",
    "Describe the concept of a superblock and its role in file system management.",
    "What is the difference between a hard link and a symbolic link?",
    "Explain the concept of file system mounting and unmounting.",
    "What is a virtual file system (VFS)? Explain its architecture.",
    "Describe the various file system operations and the system calls used to perform them.",
    "Explain the concept of disk scheduling and its importance.",
    "Describe the FCFS disk scheduling algorithm with an example.",
    "What is the SCAN (elevator) disk scheduling algorithm? Explain with an example.",
    "Compare the SSTF and SCAN disk scheduling algorithms.",
    "Explain the LOOK and C-LOOK disk scheduling algorithms.",
    "What is disk formatting? Explain low-level and high-level formatting.",
    "Describe the concept of RAID and its various levels.",
    "What is the purpose of a journaling file system? Explain how it works.",
    "Explain the concept of swap space management in operating systems.",
    "Describe the various data structures used by the file system to manage free space.",
    "How does a file system handle disk block allocation for large files?",
  ],
  6: [
    "Explain the concept of a protection domain and its relationship to access control.",
    "Describe the access matrix model for protection.",
    "What is the difference between capability-based and access-list-based protection?",
    "Explain the principle of least privilege with an example.",
    "Describe the concept of access control lists (ACLs) in file systems.",
    "What is a protection ring? Explain how it is used in the MULTICS system.",
    "Explain the concept of authentication and authorization in system security.",
    "Describe the various types of malware and their impacts on system security.",
    "What is a buffer overflow attack? How can it be prevented?",
    "Explain the concept of encryption and its role in securing data.",
    "Describe the difference between symmetric and asymmetric encryption.",
    "What is a digital signature? Explain its role in authentication.",
    "Explain the concept of a firewall and its types.",
    "Describe the various intrusion detection systems (IDS) and their classification.",
    "What is the concept of a trusted system? Explain the evaluation criteria.",
    "Explain the role of cryptography in ensuring data integrity and confidentiality.",
    "Describe the concept of the confused deputy problem in computer security.",
    "What are covert channels? Explain their types.",
    "Explain the concept of the security kernel and its properties.",
    "Describe the Windows security model including access tokens and security descriptors.",
    "How do operating systems implement secure boot and trusted platform modules (TPM)?",
  ],
};

async function main() {
  console.log("--- Development Seed: Populating One Complete Subject ---");

  // Find contributor assignments and get the first bank
  const assign = await prisma.responsibilityAssignment.findFirst({
    where: { responsibility: "CONTRIBUTOR", scopeType: "QUESTION_BANK" },
    select: { scopeId: true },
  });
  if (!assign || !assign.scopeId) {
    console.log("No contributor assignments found. Ensure seed data has contributors.");
    return;
  }
  let b = await prisma.questionBank.findUnique({
    where: { id: assign.scopeId },
    include: { subject: true, pattern: true, batchSemester: { include: { academicYear: true, batch: true } } },
  });
  if (!b) {
    console.log("Question bank not found.");
    return;
  }

  console.log(`Using bank: ${b.subject.subjectName} (${b.id})`);

  // Find the active subject version
  const subjectVersion = await prisma.subjectVersion.findFirst({
    where: { subjectId: b.subjectId, status: "ACTIVE" },
  });
  if (!subjectVersion) {
    console.log("No active subject version found. Skipping.");
    return;
  }

  // Find contributors assigned to this bank
  const contributorAssignments = await prisma.responsibilityAssignment.findMany({
    where: { scopeId: b.id, scopeType: "QUESTION_BANK", responsibility: "CONTRIBUTOR" },
    include: { user: { select: { id: true, name: true } } },
  });
  if (contributorAssignments.length === 0) {
    console.log("No contributors assigned to this bank. Skipping.");
    return;
  }
  const contributors = contributorAssignments.map((a) => a.user);

  // Find moderators assigned to this bank
  const moderatorAssignments = await prisma.responsibilityAssignment.findMany({
    where: { scopeId: b.id, scopeType: "QUESTION_BANK", responsibility: "MODERATOR" },
    include: { user: { select: { id: true, name: true } } },
  });
  const moderators = moderatorAssignments.map((a) => a.user);

  const totalSlots = b.pattern?.totalSlots ?? 126;
  const modules = b.pattern?.totalModules ?? 6;
  const marksPattern = (b.pattern?.marksPattern as number[]) ?? [2, 5, 10];
  const slotsPerModule = b.pattern?.slotsPerModule ?? 7;

  console.log(`Subject: ${b.subject.subjectName}`);
  console.log(`Bank: ${b.id}`);
  console.log(`Slots: ${totalSlots} (${modules} modules × ${marksPattern.length} marks × ${slotsPerModule} slots)`);
  console.log(`Contributors: ${contributors.map((c) => c.name).join(", ")}`);
  console.log(`Moderators: ${moderators.map((m) => m.name).join(", ")}`);
  console.log(`Subject Version: ${subjectVersion.id}`);

  const existingSlots = await prisma.questionSlot.findMany({
    where: { questionBankId: b.id },
    include: { assignedQuestion: { select: { id: true, questionText: true } } },
  });
  console.log(`Existing slots in DB: ${existingSlots.length}`);
  console.log(`Existing slots with assigned questions: ${existingSlots.filter((s) => s.assignedQuestion).length}`);

  // Build the full slot grid
  const allSlotKeys: Array<{ moduleNumber: number; marks: number; slotNumber: number }> = [];
  for (let m = 1; m <= modules; m++) {
    for (const mk of marksPattern) {
      for (let s = 1; s <= slotsPerModule; s++) {
        allSlotKeys.push({ moduleNumber: m, marks: mk, slotNumber: s });
      }
    }
  }

  const existingByKey = new Map(existingSlots.map((s) => [`${s.moduleNumber}-${s.marks}-${s.slotNumber}`, s]));
  console.log(`Existing slots with assigned questions: ${existingSlots.filter((s) => s.assignedQuestion).length}`);

  // Determine which slots need new questions
  const slotsToFill = allSlotKeys.filter((key) => {
    const existing = existingByKey.get(`${key.moduleNumber}-${key.marks}-${key.slotNumber}`);
    return !existing || !existing.assignedQuestion;
  });

  console.log(`Slots needing questions: ${slotsToFill.length}`);

  if (slotsToFill.length === 0) {
    console.log("All slots already filled. Checking for missing data...");
  }

  // Generate questions for each empty slot
  // 120 approved, 6 pending
  const totalQuestions = slotsToFill.length;
  const approvedCount = Math.max(0, totalQuestions - 6);
  const pendingCount = totalQuestions - approvedCount;

  // Mark the last 6 slots as pending (across different modules/marks)
  const pendingSlots = new Set(
    slotsToFill.slice(-6).map((s) => `${s.moduleNumber}-${s.marks}-${s.slotNumber}`),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Assign questions to contributors in round-robin
  function getContributor(index: number) {
    return contributors[index % contributors.length];
  }

  // Assign moderators in round-robin for events
  function getModerator(index: number) {
    if (moderators.length === 0) return null;
    return moderators[index % moderators.length];
  }

  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);

  for (let i = 0; i < slotsToFill.length; i++) {
    const key = slotsToFill[i];
    const slotKey = `${key.moduleNumber}-${key.marks}-${key.slotNumber}`;
    const isPending = pendingSlots.has(slotKey);
    const contributor = getContributor(i);

    // Check if slot already exists with an assigned question
    const existingSlot = existingByKey.get(slotKey);

    if (existingSlot?.assignedQuestion) {
      skipped++;
      continue;
    }

    // Generate question text for this module
    const moduleQuestions = Q1[key.moduleNumber] ?? Q1[1];
    const questionText = moduleQuestions[i % moduleQuestions.length];

    // Pick metadata
    const coMapping = pick(COS);
    const rbtLevel = pick(RBT_LEVELS);
    const difficultyLevel = pick(DIFFICULTIES);
    const teachingIndex = `${key.moduleNumber}.${key.slotNumber}`;

    const status = isPending ? QuestionStatus.PENDING : QuestionStatus.APPROVED;
    const submittedAt = new Date(twoWeeksAgo.getTime() + i * 3600000);
    const reviewedAt = isPending ? null : new Date(submittedAt.getTime() + 7200000);

    // Create the question
    const question = await prisma.questionLibraryItem.create({
      data: {
        subjectVersionId: subjectVersion.id,
        moduleNumber: key.moduleNumber,
        marks: key.marks,
        questionText,
        coMapping,
        rbtLevel,
        difficultyLevel,
        teachingIndex,
        status,
        createdById: contributor.id,
        ownerId: contributor.id,
        submittedAt,
        reviewedAt,
      },
    });

    // Create initial revision
    await prisma.questionRevision.create({
      data: {
        questionId: question.id,
        revisionNumber: 1,
        snapshotQuestionText: questionText,
        snapshotModule: key.moduleNumber,
        snapshotMarks: key.marks,
        snapshotCo: coMapping,
        snapshotRbt: rbtLevel,
        snapshotDifficulty: difficultyLevel,
        snapshotTeachingIndex: teachingIndex,
        changedById: contributor.id,
        changeReason: "Initial creation",
      },
    });

    // Assign to slot (create if doesn't exist, update if exists without question)
    if (existingSlot && !existingSlot.assignedQuestion) {
      await prisma.questionSlot.update({
        where: { id: existingSlot.id },
        data: { assignedQuestionId: question.id },
      });
    } else {
      // Ensure the slot exists
      const slot = await prisma.questionSlot.findUnique({
        where: {
          questionBankId_moduleNumber_marks_slotNumber: {
            questionBankId: b.id,
            moduleNumber: key.moduleNumber,
            marks: key.marks,
            slotNumber: key.slotNumber,
          },
        },
      });
      if (slot) {
        await prisma.questionSlot.update({
          where: { id: slot.id },
          data: { assignedQuestionId: question.id },
        });
      }
    }

    // Create moderation event for approved questions
    if (!isPending && moderators.length > 0) {
      const mod = getModerator(i);
      if (mod) {
        await prisma.moderationEvent.create({
          data: {
            questionId: question.id,
            moderatorId: mod.id,
            action: "QUESTION_APPROVED",
            note: "Approved during development seeding.",
            createdAt: reviewedAt!,
          },
        });
      }
    }

    created++;
  }

  console.log(`\n--- Seed Complete ---`);
  console.log(`Questions created: ${created}`);
  console.log(`Questions skipped (already existed): ${skipped}`);
  console.log(`Total slots targeted: ${slotsToFill.length}`);
  console.log(`Approved: ${slotsToFill.length - pendingCount}`);
  console.log(`Pending: ${pendingCount}`);

  // Final verification
  const finalSlots = await prisma.questionSlot.findMany({
    where: { questionBankId: b.id },
    include: { assignedQuestion: { select: { id: true, status: true } } },
  });
  const filled = finalSlots.filter((s) => s.assignedQuestion).length;
  const pending = finalSlots.filter((s) => s.assignedQuestion?.status === "PENDING");
  const approved = finalSlots.filter((s) => s.assignedQuestion?.status === "APPROVED");
  console.log(`\n--- Final State ---`);
  console.log(`Total slots: ${finalSlots.length}`);
  console.log(`Filled slots: ${filled}`);
  console.log(`Approved questions: ${approved.length}`);
  console.log(`Pending questions: ${pending.length}`);
  console.log(`Empty slots: ${finalSlots.length - filled}`);
  console.log(`\nBank ID: ${b.id}`);
  console.log(`Subject: ${b.subject.subjectName} (${b.subject.subjectCode})`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
