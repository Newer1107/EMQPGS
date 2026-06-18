import { PrismaClient, Role, ExamType, QuestionBankPhase, RecordStatus, QuestionStatus, RbtLevel, CourseOutcome, DifficultyLevel, ExamCycleStatus, UserStatus, SubjectStatus, BatchStatus, BatchSemesterStatus, AcademicYearStatus, AcademicUnitType, GroupAssignment, SnapshotType, NotificationType, ReviewStatus, PaperGenerationStatus, PaperVariant, AiReportStatus, CoordinatorDecision } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

function dt(y: number, m: number, d: number) { return new Date(y, m - 1, d); }

const MARKS_PATTERN = [2, 5, 10] as const;
function buildSlots(totalModules: number) {
  const slots: Array<{ moduleNumber: number; marks: number; slotNumber: number }> = [];
  for (let m = 1; m <= totalModules; m++)
    for (const marks of MARKS_PATTERN)
      for (let s = 1; s <= 7; s++) slots.push({ moduleNumber: m, marks, slotNumber: s });
  return slots;
}

const EXAM_TYPE_ISE = { examType: ExamType.ISE_1, totalModules: 3, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 63 };
const EXAM_TYPE_ISE2 = { examType: ExamType.ISE_2, totalModules: 3, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 63 };
const EXAM_TYPE_END = { examType: ExamType.ENDSEM, totalModules: 6, marksPattern: [2, 5, 10], slotsPerModule: 7, totalSlots: 126 };

function realisticQ(subjectCode: string, module: number, marks: number, slot: number, co: CourseOutcome, rbt: RbtLevel, subject: string): string {
  const qs: Record<string, string[]> = {
    "DBMS": [
      "Explain the ACID properties of database transactions with examples.",
      "Differentiate between B-tree and B+ tree indexing structures used in database systems.",
      "Design an ER diagram for a library management system identifying all entities and relationships.",
      "Write SQL queries for the given relational schema involving JOIN, GROUP BY, and HAVING clauses.",
      "Explain normalization forms (1NF, 2NF, 3NF, BCNF) with a real-world example for each.",
      "Describe the two-phase locking protocol and how it ensures serializability in concurrent transactions.",
    ],
    "DAA": [
      "Analyze the time complexity of Merge Sort and Quick Sort using recurrence relations.",
      "Explain the dynamic programming approach to solve the 0/1 Knapsack problem with an example.",
      "Design a greedy algorithm for Huffman encoding and prove its optimality.",
      "Compare and contrast the time and space complexity of BFS and DFS graph traversal algorithms.",
      "Solve the All-Pairs Shortest Path problem using Floyd-Warshall algorithm with a step-by-step example.",
      "Explain the concept of NP-completeness and reduce the Vertex Cover problem to SAT.",
    ],
    "OS": [
      "Explain the process states in the five-state process model with a state transition diagram.",
      "Describe the banker's algorithm for deadlock avoidance with a worked example.",
      "Compare contiguous, paged, and segmented memory allocation strategies.",
      "Explain the concept of virtual memory and how demand paging handles page faults.",
      "Describe the scheduling algorithms FCFS, SJF, and Round Robin with a comparative example.",
      "Explain the producer-consumer problem and its solution using semaphores.",
    ],
    "CN": [
      "Explain the OSI reference model with the function of each of the seven layers.",
      "Describe how TCP ensures reliable data delivery using sequence numbers and acknowledgments.",
      "Compare IPv4 and IPv6 addressing schemes with an example of subnetting for each.",
      "Explain the CSMA/CD protocol and how it handles collisions in Ethernet networks.",
      "Describe the distance vector routing algorithm with an example of count-to-infinity problem.",
      "Explain the working of DNS in resolving domain names to IP addresses step-by-step.",
    ],
    "DLD": [
      "Simplify the given Boolean expression using Karnaugh map and implement using NAND gates only.",
      "Design a 4-bit synchronous binary counter using JK flip-flops with excitation table.",
      "Explain the working of a 4-to-1 multiplexer with logic diagram and truth table.",
      "Design a 3-bit ripple carry adder and explain its propagation delay limitation.",
      "Implement a BCD to 7-segment decoder using logic gates with truth table.",
      "Explain the difference between combinational and sequential circuits with examples.",
    ],
    "MATH": [
      "Solve the given system of linear equations using Gauss elimination method.",
      "Find the eigenvalues and eigenvectors of a 3x3 matrix with step-by-step calculation.",
      "Apply the Cayley-Hamilton theorem to find the inverse of a given matrix.",
      "Explain the concept of linear independence and basis with examples in R^3.",
      "Compute the rank and nullity of a given matrix and verify the rank-nullity theorem.",
      "Solve the given differential equation using the method of undetermined coefficients.",
    ],
    "DSA": [
      "Implement an algorithm to reverse a linked list in-place with O(n) time complexity.",
      "Explain the working of AVL tree rotations with insertion examples for each case.",
      "Compare the time complexity of binary search trees, heaps, and hash tables for search operations.",
      "Write pseudocode for DFS traversal and identify its applications in graph theory.",
      "Explain how a priority queue can be implemented using a binary heap with insertion and deletion.",
      "Design a circular queue data structure and implement enqueue/dequeue operations.",
    ],
    "CG": [
      "Explain the Bresenham's line drawing algorithm with a numerical example.",
      "Describe the Cohen-Sutherland line clipping algorithm with region codes.",
      "Derive the 3D transformation matrices for translation, scaling, and rotation about arbitrary axes.",
      "Explain the Z-buffer algorithm for hidden surface removal with a test scene.",
      "Describe the Phong illumination model and how it differs from Gouraud shading.",
      "Write the composite transformation matrix for rotating a 2D object about an arbitrary pivot point.",
    ],
    "TOC": [
      "Construct a DFA for the language L = {w ∈ {0,1}* | w contains at least two 0's and at most one 1}.",
      "Convert the given NFA to its equivalent DFA using the subset construction algorithm.",
      "Prove that the language L = {a^n b^n | n ≥ 1} is not regular using the pumping lemma.",
      "Design a context-free grammar for the language L = {a^i b^j c^k | i ≠ j or j ≠ k}.",
      "Construct a Turing machine to recognize the language L = {ww^R | w ∈ {0,1}* }.",
      "Explain the Chomsky hierarchy with examples of languages at each level.",
    ],
    "AIML": [
      "Explain the concept of supervised learning with examples of classification and regression.",
      "Describe the working of a decision tree algorithm using information gain and Gini index.",
      "Implement the perceptron learning algorithm for a binary classification problem.",
      "Explain how the K-means clustering algorithm works with a numerical example.",
      "Describe the backpropagation algorithm for training multi-layer neural networks.",
      "Compare the performance of Naive Bayes and SVM classifiers on text classification tasks.",
    ],
    "MP": [
      "Write an 8085 assembly language program to add two 16-bit numbers stored in memory.",
      "Explain the addressing modes of 8086 microprocessor with examples for each mode.",
      "Describe the architecture of 8086 microprocessor with a block diagram of internal units.",
      "Write an assembly program using DOS interrupt 21h to read a string from keyboard and display it.",
      "Explain the memory segmentation scheme in 8086 and calculate physical addresses.",
      "Compare the features of RISC and CISC architectures with examples of each.",
    ],
    "SPCC": [
      "Explain the phases of a compiler with a diagram showing input-output at each phase.",
      "Write a LEX program to identify all tokens in a given C program snippet.",
      "Construct an LL(1) parsing table for the given grammar and parse a sample string.",
      "Explain the concept of syntax-directed translation with an example of infix to postfix conversion.",
      "Describe the intermediate code representations: three-address code, quadruples, and triples.",
      "Explain the role of a linker and loader with the relocation and linking process.",
    ],
    "SE": [
      "Explain the Waterfall, Agile, and Spiral software process models with their strengths and weaknesses.",
      "Describe the role of SRS (Software Requirements Specification) with a template for a library system.",
      "Draw a UML class diagram for an online shopping system showing key classes and relationships.",
      "Explain the concept of software testing levels: unit, integration, system, and acceptance testing.",
      "Describe the COCOMO cost estimation model and calculate effort for a given project size.",
      "Explain risk management in software engineering with a risk assessment matrix example.",
    ],
    "DWM": [
      "Explain the concept of data warehousing with the three-tier architecture diagram.",
      "Describe the ETL process with a case study of building a sales data warehouse.",
      "Differentiate between OLTP and OLAP systems with comparative analysis.",
      "Explain the Apriori algorithm for frequent itemset mining with a market basket example.",
      "Describe the FP-growth algorithm and compare its efficiency with Apriori.",
      "Explain classification using decision trees with the ID3 algorithm and an example dataset.",
    ],
    "CYBERSEC": [
      "Explain the Caesar, Playfair, and Vigenère cipher techniques with encryption examples.",
      "Describe the RSA algorithm with a step-by-step example of key generation and encryption.",
      "Explain the Diffie-Hellman key exchange protocol and how it achieves secure key agreement.",
      "Describe the structure and working of the AES algorithm with the SubBytes and ShiftRows steps.",
      "Explain the concept of digital signatures and how they provide authentication and non-repudiation.",
      "Describe the SSL/TLS handshake protocol with the sequence of messages exchanged.",
    ],
    "CC": [
      "Explain the phases of a compiler with a diagram showing input-output at each phase.",
      "Write a LEX program to identify all tokens in a given C program snippet.",
      "Construct an LL(1) parsing table for the given grammar and parse a sample string.",
      "Explain the concept of syntax-directed translation with an example of infix to postfix conversion.",
      "Describe the intermediate code representations: three-address code, quadruples, and triples.",
      "Explain the role of a linker and loader with the relocation and linking process.",
    ],
    "DM": [
      "Differentiate between data mining and data warehousing with application examples.",
      "Explain the KDD process with each step illustrated using a real-world dataset scenario.",
      "Describe the Naive Bayes classifier and apply it to a weather dataset classification problem.",
      "Explain clustering techniques: K-means, hierarchical, and DBSCAN with comparative analysis.",
      "Describe association rule mining with the Apriori algorithm and confidence/support measures.",
      "Explain outlier detection methods in data mining with statistical and distance-based approaches.",
    ],
    "DC": [
      "Explain the characteristics of distributed systems: transparency, scalability, and fault tolerance.",
      "Describe the Lamport's logical clock algorithm for maintaining event ordering in distributed systems.",
      "Explain the two-phase commit protocol for distributed transaction coordination.",
      "Describe the Chord protocol for distributed hash tables and its lookup mechanism.",
      "Explain the MapReduce programming model with a word count example.",
      "Describe the CAP theorem and its implications for distributed database design.",
    ],
    "SA": [
      "Explain the architectural styles: layered, pipe-and-filter, and event-driven architectures.",
      "Describe the MVC architectural pattern with a web application example showing component interactions.",
      "Explain the concept of microservices architecture and its advantages over monolithic systems.",
      "Describe the design patterns: Singleton, Factory, Observer, and Strategy with UML diagrams.",
      "Explain the quality attribute scenarios for performance, security, and modifiability.",
      "Describe the Architecture Tradeoff Analysis Method (ATAM) with its steps and outputs.",
    ],
    "GENERIC": [
      `Explain the core concepts and principles covered in Module ${module} with suitable examples from real-world applications.`,
      `Compare and contrast the different approaches and techniques discussed in Module ${module}.`,
      `Design a solution for a complex problem applying the methodologies covered in Module ${module}.`,
      `Analyze the performance impact of various design choices discussed in Module ${module} with supporting evidence.`,
      `Describe the architecture and working mechanisms relevant to the topics in Module ${module}.`,
      `Evaluate the strengths and limitations of different techniques presented in Module ${module}.`,
    ],
  };

  const subjKey = Object.keys(qs).find(k => subject.includes(k) || subjectCode.includes(k)) || "GENERIC";
  const pool = qs[subjKey];
  const idx = (module * 7 + slot) % pool.length;
  return `[${marks} marks, ${co}, ${rbt}] ${pool[idx]} Provide a well-structured answer with appropriate diagrams where applicable.`;
}

const CO_LIST = [CourseOutcome.CO1, CourseOutcome.CO2, CourseOutcome.CO3, CourseOutcome.CO4, CourseOutcome.CO5, CourseOutcome.CO6];
const RBT_LIST = [RbtLevel.L1, RbtLevel.L2, RbtLevel.L3, RbtLevel.L4, RbtLevel.L5, RbtLevel.L6];
const DIFF_LIST = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD];

async function main() {
  console.log("🌱 Starting comprehensive production seed for TCET Computer Engineering...");
  const pwh = await bcrypt.hash(PASSWORD, 12);

  // ═══════════════════════════════════════════════════════════════
  // 1. FOUNDATION: Academic Units, Departments, Programmes, Schemes
  // ═══════════════════════════════════════════════════════════════
  const eshUnit = await prisma.academicUnit.create({ data: { name: "Engineering Sciences & Humanities", code: "ESH", type: AcademicUnitType.ES_H, hodName: "Dr. First Year Incharge" } });
  const compUnit = await prisma.academicUnit.create({ data: { name: "Computer Engineering", code: "COMP", type: AcademicUnitType.DEPARTMENT, hodName: "Dr. Suresh Patil" } });

  const dept = await prisma.department.create({ data: { name: "Computer Engineering", code: "COMP", hodName: "Dr. Suresh Patil" } });

  const progComp = await prisma.programme.create({ data: { name: "BE Computer Engineering", code: "BECOMP", homeAcademicUnitId: compUnit.id, firstYearAcademicUnitId: eshUnit.id } });

  const scheme2024 = await prisma.curriculumScheme.create({ data: { programmeId: progComp.id, name: "2024 Scheme (CBCGS-HME 2023)", year: 2024 } });
  const scheme2025 = await prisma.curriculumScheme.create({ data: { programmeId: progComp.id, name: "2025 Scheme (CBCGS-HME 2023)", year: 2025 } });

  // ═══════════════════════════════════════════════════════════════
  // 2. ACADEMIC YEARS (3 years of history)
  // ═══════════════════════════════════════════════════════════════
  const ay24_25 = await prisma.academicYear.create({ data: { code: "2024-2025", startDate: dt(2024, 6, 1), endDate: dt(2025, 5, 31), status: AcademicYearStatus.CLOSED } });
  const ay25_26 = await prisma.academicYear.create({ data: { code: "2025-2026", startDate: dt(2025, 6, 1), endDate: dt(2026, 5, 31), status: AcademicYearStatus.CLOSED } });
  const ay26_27 = await prisma.academicYear.create({ data: { code: "2026-2027", startDate: dt(2026, 6, 1), endDate: dt(2027, 5, 31), status: AcademicYearStatus.ACTIVE } });

  // ═══════════════════════════════════════════════════════════════
  // 3. ALL COMP SUBJECTS (full TCET curriculum)
  // ═══════════════════════════════════════════════════════════════
  type SubjectDef = { code: string; name: string; credits: number; hasLab: boolean; semesters: number[]; scheme: number };
  const ALL_SUBJECTS: SubjectDef[] = [
    // Sem III (2024 scheme)
    { code: "HSMC-301", name: "Universal Human Values-II", credits: 3, hasLab: false, semesters: [3], scheme: 2024 },
    { code: "BSC-COMP-301", name: "Mathematics-III", credits: 4, hasLab: false, semesters: [3], scheme: 2024 },
    { code: "ESC-COMP-301", name: "Digital Logic Design & Computer Architecture", credits: 4, hasLab: true, semesters: [3], scheme: 2024 },
    { code: "PCC-COMP-302", name: "Database Management System", credits: 4, hasLab: true, semesters: [3], scheme: 2024 },
    { code: "PCC-COMP-303", name: "Data Structure using JAVA", credits: 5, hasLab: true, semesters: [3], scheme: 2024 },
    // Sem IV (2025 scheme)
    { code: "BSC-COMP-401", name: "Mathematics-IV", credits: 4, hasLab: false, semesters: [4], scheme: 2025 },
    { code: "PCC-COMP-401", name: "Design and Analysis of Algorithm using Python", credits: 4, hasLab: true, semesters: [4], scheme: 2025 },
    { code: "PCC-COMP-402", name: "Operating System", credits: 4, hasLab: true, semesters: [4], scheme: 2025 },
    { code: "PCC-COMP-403", name: "Computer Networks", credits: 4, hasLab: true, semesters: [4], scheme: 2025 },
    // Sem V (2024 scheme)
    { code: "HSMC-501", name: "Soft Skill & Interpersonal Communication", credits: 3, hasLab: false, semesters: [5], scheme: 2024 },
    { code: "ESC-COMP-501", name: "Computer Graphics", credits: 4, hasLab: true, semesters: [5], scheme: 2024 },
    { code: "PCC-COMP-501", name: "Theory of Computation", credits: 4, hasLab: false, semesters: [5], scheme: 2024 },
    { code: "PCC-COMP-502", name: "Introduction to Intelligent Systems", credits: 4, hasLab: true, semesters: [5], scheme: 2024 },
    { code: "PCC-COMP-503", name: "Microprocessor", credits: 4, hasLab: true, semesters: [5], scheme: 2024 },
    // Sem VI (2024 scheme)
    { code: "HSMC-601", name: "Work Place Mental Health", credits: 2, hasLab: false, semesters: [6], scheme: 2024 },
    { code: "PCC-COMP-601", name: "System Programming & Compiler Construction", credits: 4, hasLab: true, semesters: [6], scheme: 2024 },
    { code: "PCC-COMP-602", name: "Software Engineering", credits: 4, hasLab: true, semesters: [6], scheme: 2024 },
    { code: "PEC-COMP-6011", name: "Advanced Operating Systems", credits: 3, hasLab: false, semesters: [6], scheme: 2024 },
    { code: "PEC-COMP-6012", name: "Mobile Computing", credits: 3, hasLab: false, semesters: [6], scheme: 2024 },
    { code: "PEC-COMP-6013", name: "Advanced Database Management System", credits: 3, hasLab: false, semesters: [6], scheme: 2024 },
    { code: "PEC-COMP-6014", name: "Multimedia Systems", credits: 3, hasLab: false, semesters: [6], scheme: 2024 },
    { code: "PEC-COMP-6015", name: "Machine Learning", credits: 3, hasLab: false, semesters: [6], scheme: 2024 },
    // Sem VII (2025 scheme)
    { code: "PCC-COMP-701", name: "Data Warehousing and Mining", credits: 4, hasLab: true, semesters: [7], scheme: 2025 },
    { code: "PCC-COMP-702", name: "Cryptography and System Security", credits: 4, hasLab: true, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7011", name: "Advanced Algorithm", credits: 4, hasLab: true, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7012", name: "Information Security", credits: 4, hasLab: true, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7013", name: "Data Analytics", credits: 4, hasLab: true, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7014", name: "Digital Signal & Image Processing", credits: 4, hasLab: true, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7015", name: "Cognitive Computing using Tensorflow", credits: 4, hasLab: true, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7021", name: "Parallel Computing", credits: 3, hasLab: false, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7022", name: "Internet of Things (IoT)", credits: 3, hasLab: false, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7023", name: "Enterprise Resource Planning", credits: 3, hasLab: false, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7024", name: "Human Computer Interaction", credits: 3, hasLab: false, semesters: [7], scheme: 2025 },
    { code: "PEC-COMP-7025", name: "Robotics", credits: 3, hasLab: false, semesters: [7], scheme: 2025 },
    // Sem VIII (2025 scheme)
    { code: "PCC-COMP-801", name: "Distributed Computing", credits: 3, hasLab: false, semesters: [8], scheme: 2025 },
    { code: "PCC-COMP-802", name: "Software Architecture", credits: 3, hasLab: false, semesters: [8], scheme: 2025 },
    { code: "PEC-COMP-8011", name: "Graph Theory", credits: 4, hasLab: true, semesters: [8], scheme: 2025 },
    { code: "PEC-COMP-8012", name: "Advanced System Security and Digital Forensics", credits: 4, hasLab: true, semesters: [8], scheme: 2025 },
    { code: "PEC-COMP-8013", name: "Data Science using Python and R", credits: 4, hasLab: true, semesters: [8], scheme: 2025 },
    { code: "PEC-COMP-8014", name: "Augmented & Virtual Reality", credits: 4, hasLab: true, semesters: [8], scheme: 2025 },
    { code: "PEC-COMP-8015", name: "Natural Language Processing", credits: 4, hasLab: true, semesters: [8], scheme: 2025 },
  ];

  const subjectMap = new Map<string, string>(); // code -> id
  const subjectVersionMap = new Map<string, string>(); // code_version -> sv id

  for (const sd of ALL_SUBJECTS) {
    const s = await prisma.subject.create({
      data: {
        subjectCode: sd.code, subjectName: sd.name, credits: sd.credits,
        questionBankDueDate: dt(2026, 12, 15), departmentId: dept.id, status: SubjectStatus.ACTIVE,
      },
    });
    subjectMap.set(sd.code, s.id);
    const ay = sd.scheme === 2024 ? ay24_25 : ay25_26;
    const sv = await prisma.subjectVersion.create({
      data: { subjectId: s.id, versionNumber: 1, title: sd.name, effectiveFromAcademicYearId: ay.id },
    });
    subjectVersionMap.set(`${sd.code}_1`, sv.id);
  }

  // Curriculum subjects
  for (const sd of ALL_SUBJECTS) {
    const scheme = sd.scheme === 2024 ? scheme2024 : scheme2025;
    for (const sem of sd.semesters) {
      await prisma.curriculumSubject.create({
        data: { curriculumSchemeId: scheme.id, subjectId: subjectMap.get(sd.code)!, semesterNumber: sem, academicUnitId: compUnit.id, groupAssignment: GroupAssignment.ALL },
      }).catch(() => {}); // skip dupes
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. BATCHES (3 cohorts)
  // ═══════════════════════════════════════════════════════════════
  const batch2023 = await prisma.batch.create({
    data: { name: "BE Computer 2023-27", code: "BECOMP2023", programmeId: progComp.id, curriculumSchemeId: scheme2024.id, admissionYear: 2023, graduationYear: 2027, status: BatchStatus.ACTIVE },
  });
  const batch2024 = await prisma.batch.create({
    data: { name: "BE Computer 2024-28", code: "BECOMP2024", programmeId: progComp.id, curriculumSchemeId: scheme2024.id, admissionYear: 2024, graduationYear: 2028, status: BatchStatus.ACTIVE },
  });
  const batch2025 = await prisma.batch.create({
    data: { name: "BE Computer 2025-29", code: "BECOMP2025", programmeId: progComp.id, curriculumSchemeId: scheme2025.id, admissionYear: 2025, graduationYear: 2029, status: BatchStatus.ACTIVE },
  });

  // Batch semesters
  const batchSemesters: Record<string, string> = {}; // `${batchCode}_semN` -> id
  type BSDef = { batchId: string; sem: number; ayId: string; unitId: string; status: BatchSemesterStatus; start: Date; end: Date };
  const bsDefs: BSDef[] = [
    // 2023 batch: Sem III (2024-25 odd), Sem IV (2024-25 even), Sem V (2025-26 odd), Sem VI (2025-26 even), Sem VII (2026-27 odd)
    { batchId: batch2023.id, sem: 3, ayId: ay24_25.id, unitId: compUnit.id, status: BatchSemesterStatus.COMPLETED, start: dt(2024, 7, 15), end: dt(2024, 12, 20) },
    { batchId: batch2023.id, sem: 4, ayId: ay24_25.id, unitId: compUnit.id, status: BatchSemesterStatus.COMPLETED, start: dt(2025, 1, 6), end: dt(2025, 6, 15) },
    { batchId: batch2023.id, sem: 5, ayId: ay25_26.id, unitId: compUnit.id, status: BatchSemesterStatus.COMPLETED, start: dt(2025, 7, 14), end: dt(2025, 12, 20) },
    { batchId: batch2023.id, sem: 6, ayId: ay25_26.id, unitId: compUnit.id, status: BatchSemesterStatus.COMPLETED, start: dt(2026, 1, 5), end: dt(2026, 6, 15) },
    { batchId: batch2023.id, sem: 7, ayId: ay26_27.id, unitId: compUnit.id, status: BatchSemesterStatus.ACTIVE, start: dt(2026, 7, 14), end: dt(2026, 12, 20) },
    // 2024 batch: Sem III (2025-26 odd), Sem IV (2025-26 even), Sem V (2026-27 odd)
    { batchId: batch2024.id, sem: 3, ayId: ay25_26.id, unitId: compUnit.id, status: BatchSemesterStatus.COMPLETED, start: dt(2025, 7, 14), end: dt(2025, 12, 20) },
    { batchId: batch2024.id, sem: 4, ayId: ay25_26.id, unitId: compUnit.id, status: BatchSemesterStatus.COMPLETED, start: dt(2026, 1, 5), end: dt(2026, 6, 15) },
    { batchId: batch2024.id, sem: 5, ayId: ay26_27.id, unitId: compUnit.id, status: BatchSemesterStatus.ACTIVE, start: dt(2026, 7, 14), end: dt(2026, 12, 20) },
    // 2025 batch: Sem III (2026-27 odd)
    { batchId: batch2025.id, sem: 3, ayId: ay26_27.id, unitId: compUnit.id, status: BatchSemesterStatus.ACTIVE, start: dt(2026, 7, 14), end: dt(2026, 12, 20) },
  ];

  for (const bd of bsDefs) {
    const bs = await prisma.batchSemester.create({
      data: { batchId: bd.batchId, semesterNumber: bd.sem, academicYearId: bd.ayId, academicUnitId: bd.unitId, startDate: bd.start, endDate: bd.end, status: bd.status },
    });
    const bCode = bd.batchId === batch2023.id ? "BECOMP2023" : bd.batchId === batch2024.id ? "BECOMP2024" : "BECOMP2025";
    batchSemesters[`${bCode}_sem${bd.sem}`] = bs.id;
  }

  // Update current semester on batches
  await prisma.batch.update({ where: { id: batch2023.id }, data: { currentSemesterNumber: 7, currentBatchSemesterId: batchSemesters["BECOMP2023_sem7"] } });
  await prisma.batch.update({ where: { id: batch2024.id }, data: { currentSemesterNumber: 5, currentBatchSemesterId: batchSemesters["BECOMP2024_sem5"] } });
  await prisma.batch.update({ where: { id: batch2025.id }, data: { currentSemesterNumber: 3, currentBatchSemesterId: batchSemesters["BECOMP2025_sem3"] } });

  // ═══════════════════════════════════════════════════════════════
  // 5. USERS (Faculty with expertise)
  // ═══════════════════════════════════════════════════════════════
  type FacultyDef = { name: string; email: string; role: Role; expertise: string[] };
  const FACULTY: FacultyDef[] = [
    { name: "Dr. Mahesh Kulkarni", email: "coe@emqpgs.local", role: Role.COE, expertise: [] },
    { name: "Dr. Prof. Anil Deshmukh", email: "coordinator.comp@emqpgs.local", role: Role.COORDINATOR, expertise: ["Database Management System", "Operating System", "Software Engineering"] },
    { name: "Dr. Sunita Joshi", email: "moderator.comp1@emqpgs.local", role: Role.MODERATOR, expertise: ["Theory of Computation", "Compiler Design", "Data Structure using JAVA"] },
    { name: "Prof. Vikram Mehta", email: "moderator.comp2@emqpgs.local", role: Role.MODERATOR, expertise: ["Computer Networks", "Cryptography", "Distributed Computing"] },
    { name: "Prof. Priya Sharma", email: "moderator.comp3@emqpgs.local", role: Role.MODERATOR, expertise: ["Machine Learning", "Data Science", "Artificial Intelligence"] },
    { name: "Prof. Rahul Verma", email: "contributor1.comp@emqpgs.local", role: Role.CONTRIBUTOR, expertise: ["Database Management System", "Operating System", "Computer Networks"] },
    { name: "Prof. Sneha Patel", email: "contributor2.comp@emqpgs.local", role: Role.CONTRIBUTOR, expertise: ["Data Structure using JAVA", "Design and Analysis of Algorithm", "Theory of Computation"] },
    { name: "Prof. Amit Singh", email: "contributor3.comp@emqpgs.local", role: Role.CONTRIBUTOR, expertise: ["Computer Graphics", "Microprocessor", "Digital Logic Design"] },
    { name: "Prof. Neha Gupta", email: "contributor4.comp@emqpgs.local", role: Role.CONTRIBUTOR, expertise: ["Software Engineering", "System Programming", "Compiler Construction"] },
    { name: "Prof. Deepak Yadav", email: "contributor5.comp@emqpgs.local", role: Role.CONTRIBUTOR, expertise: ["Machine Learning", "Data Warehousing", "Data Analytics"] },
    { name: "Prof. Meera Iyer", email: "contributor6.comp@emqpgs.local", role: Role.CONTRIBUTOR, expertise: ["Cryptography", "Information Security", "Network Security"] },
    { name: "Prof. Rohan Patil", email: "contributor7.comp@emqpgs.local", role: Role.CONTRIBUTOR, expertise: ["Distributed Computing", "Parallel Computing", "Software Architecture"] },
    { name: "Dr. Vandana Rao", email: "dean@emqpgs.local", role: Role.DEAN, expertise: [] },
  ];

  const userMap = new Map<string, string>(); // email -> id
  const facultyByExpertise = new Map<string, string[]>(); // expertise area -> user IDs

  for (const f of FACULTY) {
    const u = await prisma.user.create({ data: { name: f.name, email: f.email, role: f.role, passwordHash: pwh, status: UserStatus.ACTIVE, departmentId: dept.id } });
    userMap.set(f.email, u.id);
    for (const exp of f.expertise) {
      if (!facultyByExpertise.has(exp)) facultyByExpertise.set(exp, []);
      facultyByExpertise.get(exp)!.push(u.id);
    }
  }

  // Coordinator-department assignment
  await prisma.coordinatorDepartmentAssignment.create({
    data: { coordinatorId: userMap.get("coordinator.comp@emqpgs.local")!, departmentId: dept.id },
  });

  const coeId = userMap.get("coe@emqpgs.local")!;
  const coordId = userMap.get("coordinator.comp@emqpgs.local")!;
  const deanId = userMap.get("dean@emqpgs.local")!;
  const moderatorIds = [userMap.get("moderator.comp1@emqpgs.local")!, userMap.get("moderator.comp2@emqpgs.local")!, userMap.get("moderator.comp3@emqpgs.local")!];
  const contributorIds = [
    userMap.get("contributor1.comp@emqpgs.local")!, userMap.get("contributor2.comp@emqpgs.local")!,
    userMap.get("contributor3.comp@emqpgs.local")!, userMap.get("contributor4.comp@emqpgs.local")!,
    userMap.get("contributor5.comp@emqpgs.local")!, userMap.get("contributor6.comp@emqpgs.local")!,
    userMap.get("contributor7.comp@emqpgs.local")!,
  ];

  function pickModerator(): string { return moderatorIds[Math.floor(Math.random() * moderatorIds.length)]; }

  // ═══════════════════════════════════════════════════════════════
  // 6. EXAM CYCLES & QUESTION BANKS (the big one)
  // ═══════════════════════════════════════════════════════════════

  // Map batch+semester -> list of subject codes for that semester
  const semesterSubjects: Record<string, string[]> = {
    "3": ["HSMC-301", "BSC-COMP-301", "ESC-COMP-301", "PCC-COMP-302", "PCC-COMP-303"],
    "4": ["BSC-COMP-401", "PCC-COMP-401", "PCC-COMP-402", "PCC-COMP-403"],
    "5": ["HSMC-501", "ESC-COMP-501", "PCC-COMP-501", "PCC-COMP-502", "PCC-COMP-503"],
    "6": ["HSMC-601", "PCC-COMP-601", "PCC-COMP-602", "PEC-COMP-6013", "PEC-COMP-6015"],
    "7": ["PCC-COMP-701", "PCC-COMP-702", "PEC-COMP-7013", "PEC-COMP-7023", "PEC-COMP-7024"],
    "8": ["PCC-COMP-801", "PCC-COMP-802", "PEC-COMP-8013", "PEC-COMP-8012"],
  };

  const workflowDistribution: Record<string, { phase: QuestionBankPhase; recordStatus: RecordStatus; fillPct: number; approvedPct: number; hasPapers: boolean; hasDeanReview: boolean; hasAiReport: boolean }> = {
    "BECOMP2023_sem3": { phase: QuestionBankPhase.COMPLETE, recordStatus: RecordStatus.LOCKED, fillPct: 1.0, approvedPct: 1.0, hasPapers: true, hasDeanReview: true, hasAiReport: true },
    "BECOMP2023_sem4": { phase: QuestionBankPhase.COMPLETE, recordStatus: RecordStatus.LOCKED, fillPct: 1.0, approvedPct: 1.0, hasPapers: true, hasDeanReview: true, hasAiReport: true },
    "BECOMP2023_sem5": { phase: QuestionBankPhase.COMPLETE, recordStatus: RecordStatus.LOCKED, fillPct: 1.0, approvedPct: 1.0, hasPapers: true, hasDeanReview: true, hasAiReport: true },
    "BECOMP2023_sem6": { phase: QuestionBankPhase.COMPLETE, recordStatus: RecordStatus.LOCKED, fillPct: 0.9, approvedPct: 0.95, hasPapers: true, hasDeanReview: true, hasAiReport: true },
    "BECOMP2023_sem7": { phase: QuestionBankPhase.APPROVAL, recordStatus: RecordStatus.ACTIVE, fillPct: 0.65, approvedPct: 0.75, hasPapers: false, hasDeanReview: false, hasAiReport: true },
    "BECOMP2024_sem3": { phase: QuestionBankPhase.COMPLETE, recordStatus: RecordStatus.LOCKED, fillPct: 1.0, approvedPct: 1.0, hasPapers: true, hasDeanReview: true, hasAiReport: true },
    "BECOMP2024_sem4": { phase: QuestionBankPhase.COMPLETE, recordStatus: RecordStatus.LOCKED, fillPct: 0.85, approvedPct: 0.95, hasPapers: true, hasDeanReview: true, hasAiReport: true },
    "BECOMP2024_sem5": { phase: QuestionBankPhase.MODERATION, recordStatus: RecordStatus.ACTIVE, fillPct: 0.5, approvedPct: 0.6, hasPapers: false, hasDeanReview: false, hasAiReport: false },
    "BECOMP2025_sem3": { phase: QuestionBankPhase.DRAFTING, recordStatus: RecordStatus.ACTIVE, fillPct: 0.2, approvedPct: 0.1, hasPapers: false, hasDeanReview: false, hasAiReport: false },
  };

  let totalBanks = 0;
  let totalQuestions = 0;
  let totalSlots = 0;

  for (const [bsKey, wf] of Object.entries(workflowDistribution)) {
    const [batchCode, _semStr] = bsKey.split("_sem");
    const sem = parseInt(_semStr);
    const bsId = batchSemesters[bsKey];
    if (!bsId) { console.log(`  ⚠️  No batch semester for ${bsKey}, skipping`); continue; }

    const subjects = semesterSubjects[_semStr] || [];

    // Create exam cycles for this batch-semester
    const endsemCycle = await prisma.examCycle.create({
      data: {
        examType: ExamType.ENDSEM, status: wf.recordStatus === RecordStatus.LOCKED ? ExamCycleStatus.CLOSED : ExamCycleStatus.ACTIVE,
        version: 1, batchSemesterId: bsId,
        startDate: dt(2026, 10, 15), endDate: dt(2026, 12, 10),
      },
    });

    await prisma.examCycle.create({
      data: {
        examType: ExamType.ISE_1, status: wf.recordStatus === RecordStatus.LOCKED ? ExamCycleStatus.CLOSED : ExamCycleStatus.ACTIVE,
        version: 1, batchSemesterId: bsId,
        startDate: dt(2026, 8, 15), endDate: dt(2026, 9, 15),
      },
    }).catch(() => {});

    await prisma.examCycle.create({
      data: {
        examType: ExamType.ISE_2, status: wf.recordStatus === RecordStatus.LOCKED ? ExamCycleStatus.CLOSED : ExamCycleStatus.ACTIVE,
        version: 1, batchSemesterId: bsId,
        startDate: dt(2026, 10, 1), endDate: dt(2026, 11, 1),
      },
    }).catch(() => {});

    // Create question banks for each subject in this semester
    for (const subjCode of subjects) {
      const subjectId = subjectMap.get(subjCode);
      if (!subjectId) { console.log(`  ⚠️  No subject ${subjCode}, skipping`); continue; }
      const svId = subjectVersionMap.get(`${subjCode}_1`);
      if (!svId) continue;

      // Link subject to exam cycle
      await prisma.subjectExamCycleLink.create({
        data: { subjectId, examCycleId: endsemCycle.id },
      }).catch(() => {});

      const contributor = contributorIds[Math.floor(Math.random() * contributorIds.length)];

      // Create question bank
      const bank = await prisma.questionBank.create({
        data: {
          subjectId, examCycleId: endsemCycle.id,
          phase: wf.phase, recordStatus: wf.recordStatus, createdById: coordId,
          lockedAt: wf.recordStatus === RecordStatus.LOCKED ? dt(2026, 12, 1) : null,
          lockedReason: wf.recordStatus === RecordStatus.LOCKED ? "Exam cycle completed - bank locked" : null,
          pattern: { create: EXAM_TYPE_END },
          slots: { createMany: { data: buildSlots(6) } },
        },
        include: { slots: true, pattern: true },
      });
      totalBanks++;

      // Assign moderator
      const modId = pickModerator();
      await prisma.moderatorBankAssignment.create({ data: { moderatorId: modId, questionBankId: bank.id } }).catch(() => {});

      // Create questions and assign to slots
      const slotsToFill = bank.slots.filter(() => Math.random() < wf.fillPct);
      let questionCount = 0;

      for (const slot of slotsToFill) {
        const co = CO_LIST[Math.floor(Math.random() * CO_LIST.length)];
        const rbt = RBT_LIST[Math.floor(Math.random() * RBT_LIST.length)];
        const diff = DIFF_LIST[Math.floor(Math.random() * DIFF_LIST.length)];
        const text = realisticQ(subjCode, slot.moduleNumber, slot.marks, slot.slotNumber, co, rbt, subjCode);

        const isApproved = Math.random() < wf.approvedPct;
        let qStatus: QuestionStatus;
        if (wf.phase === QuestionBankPhase.COMPLETE || wf.phase === QuestionBankPhase.APPROVAL) {
          qStatus = isApproved ? QuestionStatus.APPROVED : (Math.random() < 0.3 ? QuestionStatus.REVISION_REQUESTED : QuestionStatus.REJECTED);
        } else if (wf.phase === QuestionBankPhase.MODERATION) {
          qStatus = isApproved ? QuestionStatus.APPROVED : (Math.random() < 0.5 ? QuestionStatus.PENDING : QuestionStatus.REVISION_REQUESTED);
        } else {
          qStatus = Math.random() < 0.3 ? QuestionStatus.PENDING : QuestionStatus.DRAFT;
        }

        const q = await prisma.questionLibraryItem.create({
          data: {
            subjectVersionId: svId, moduleNumber: slot.moduleNumber, marks: slot.marks,
            questionText: text, coMapping: co, rbtLevel: rbt, difficultyLevel: diff,
            status: qStatus, createdById: contributor, ownerId: contributor,
            submittedAt: qStatus !== QuestionStatus.DRAFT ? new Date() : null,
            reviewedAt: qStatus === QuestionStatus.APPROVED || qStatus === QuestionStatus.REJECTED ? new Date() : null,
          },
        });
        questionCount++;
        totalQuestions++;

        // Assign to slot
        await prisma.questionSlot.update({
          where: { id: slot.id },
          data: { assignedQuestionId: q.id },
        });
        totalSlots++;

        // Create revision history
        await prisma.questionRevision.create({
          data: {
            questionId: q.id, revisionNumber: 1,
            snapshotQuestionText: text, snapshotModule: slot.moduleNumber, snapshotMarks: slot.marks,
            snapshotCo: co, snapshotRbt: rbt, snapshotDifficulty: diff,
            changedById: contributor, changeReason: "Initial creation during seed",
          },
        });

        // Moderation events for approved/rejected questions
        if (qStatus === QuestionStatus.APPROVED || qStatus === QuestionStatus.REJECTED) {
          await prisma.moderationEvent.create({
            data: {
              questionId: q.id, moderatorId: modId,
              action: qStatus === QuestionStatus.APPROVED ? "APPROVED" : "REJECTED",
              note: qStatus === QuestionStatus.APPROVED ? "Question meets quality standards." : "Requires improvement in explanation depth.",
            },
          });
        }
      }

      // ── AI Reports ──
      if (wf.hasAiReport) {
        await prisma.aiReport.create({
          data: {
            questionBankId: bank.id, status: AiReportStatus.COMPLETED,
            modelName: "seed-analysis-engine",
            summary: `Analysis of ${bank.subjectId}: ${questionCount} questions across 6 modules. Coverage is adequate with good CO/RBT distribution.`,
            reportJson: { questionCount, modulesCovered: new Set(bank.slots.filter(s => s.assignedQuestionId).map(s => s.moduleNumber)).size, avgMarks: 5 },
            generatedAt: new Date(),
          },
        });
      }

      // ── Phase advancement & approval decisions ──
      if (wf.phase === QuestionBankPhase.COMPLETE || wf.phase === QuestionBankPhase.APPROVAL) {
        // Transition through phases if needed
        if (wf.phase === QuestionBankPhase.COMPLETE || wf.phase === QuestionBankPhase.APPROVAL) {
          // Create approval decision
          await prisma.approvalDecision.create({
            data: {
              questionBankId: bank.id,
              decision: CoordinatorDecision.APPROVED,
              remark: "Question bank content verified and approved for examination use.",
              decidedById: coordId, decidedAt: dt(2026, 11, 20),
            },
          }).catch(() => {});
        }

        // ── Paper generation ──
        if (wf.hasPapers && wf.phase === QuestionBankPhase.COMPLETE) {
          const filledSlots = bank.slots.filter(s => s.assignedQuestionId);
          for (const variant of [PaperVariant.PAPER_A, PaperVariant.PAPER_B, PaperVariant.PAPER_C] as const) {
            const selected = filledSlots.slice(0, 18).map(s => s.assignedQuestionId!).filter(Boolean);
            if (selected.length < 3) continue;
            const paper = await prisma.generatedPaper.create({
              data: {
                questionBankId: bank.id, variant,
                status: PaperGenerationStatus.COMPLETED, generatedById: coeId, generatedAt: dt(2026, 11, 25),
                coverageScore: 85 + Math.random() * 10, difficultyScore: 70 + Math.random() * 20,
                qualityScore: 75 + Math.random() * 15, duplicateRisk: Math.random() * 10,
                recommendation: "Recommended for dean review; paper shows reasonable balance.",
                paperJson: { inventoryWarnings: [], questionIds: selected },
                items: { create: selected.map(qId => ({ questionId: qId })) },
              },
            });
            // Snapshot
            await prisma.paperSnapshot.create({
              data: {
                questionBankId: bank.id, variant,
                paperJson: paper.paperJson ?? {}, coverageScore: paper.coverageScore,
                difficultyScore: paper.difficultyScore, qualityScore: paper.qualityScore,
              },
            }).catch(() => {});
          }
        }

        // ── Dean Review ──
        if (wf.hasDeanReview && wf.phase === QuestionBankPhase.COMPLETE) {
          await prisma.deanReview.create({
            data: {
              questionBankId: bank.id, reviewedById: deanId,
              regularPaper: PaperVariant.PAPER_A, supplementaryPaper: PaperVariant.PAPER_B, ktPaper: PaperVariant.PAPER_C,
              notes: "All three paper variants verified. Content coverage is comprehensive and balanced.",
              status: ReviewStatus.CONFIRMED, reviewedAt: dt(2026, 12, 5),
            },
          }).catch(() => {});
        }

        // ── Bank Snapshot (LOCKED) ──
        if (wf.recordStatus === RecordStatus.LOCKED) {
          await prisma.questionBankSnapshot.create({
            data: {
              questionBankId: bank.id, snapshotType: SnapshotType.LOCKED,
              phase: bank.phase, status: RecordStatus.LOCKED,
              slotAssignments: bank.slots.map(s => ({ id: s.id, moduleNumber: s.moduleNumber, marks: s.marks, slotNumber: s.slotNumber, assignedQuestionId: s.assignedQuestionId })),
              version: 1,
            },
          }).catch(() => {});
        }
      }

      // ── Audit Log ──
      await prisma.auditLog.create({
        data: {
          actorId: coordId, action: "QUESTION_BANK_INITIALIZED",
          entityType: "QUESTION_BANK", entityId: bank.id,
          metadata: { subjectCode: subjCode, semester: sem, batchCode, phase: wf.phase },
        },
      });
      if (wf.phase === QuestionBankPhase.COMPLETE) {
        await prisma.auditLog.create({
          data: { actorId: coeId, action: "QUESTION_BANK_LOCKED", entityType: "QUESTION_BANK", entityId: bank.id, metadata: { lockedAt: new Date().toISOString() } },
        });
      }

      // ── Notifications ──
      for (const modId of moderatorIds.slice(0, 1)) {
        await prisma.notification.create({
          data: {
            recipientId: modId, title: "Question Bank Ready for Review",
            message: `Question bank for ${subjCode} is ready for ${wf.phase === QuestionBankPhase.COMPLETE ? "review" : "moderation"}.`,
            type: wf.phase === QuestionBankPhase.COMPLETE ? NotificationType.SUCCESS : NotificationType.ACTION_REQUIRED,
            actionUrl: `/dashboard/moderator/question-banks?bank=${bank.id}`,
            createdAt: dt(2026, 11, 1),
          },
        }).catch(() => {});
      }

      console.log(`  ✅ ${batchCode} Sem ${sem} | ${subjCode} | ${QuestionBankPhase[wf.phase]} | ${questionCount} Qs`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. ADDITIONAL: Some DRAFT and REVISION_REQUESTED states
  // ═══════════════════════════════════════════════════════════════

  // Create a few banks with DRAFT phase explicitly (BECOMP2025_sem3 with low fill)
  const sem3_25 = batchSemesters["BECOMP2025_sem3"];
  if (sem3_25) {
    // Ensure some draft banks exist for completeness
    const ecIse1 = await prisma.examCycle.findFirst({ where: { batchSemesterId: sem3_25, examType: ExamType.ISE_1 } });
    const ecIse2 = await prisma.examCycle.findFirst({ where: { batchSemesterId: sem3_25, examType: ExamType.ISE_2 } });

    for (const [subjCode] of Object.entries(subjectMap)) {
      const sis = semesterSubjects["3"];
      if (!sis?.includes(subjCode)) continue;
      const subjectId = subjectMap.get(subjCode)!;
      const svId = subjectVersionMap.get(`${subjCode}_1`);
      if (!svId) continue;

      if (ecIse1) {
        await prisma.subjectExamCycleLink.create({ data: { subjectId, examCycleId: ecIse1.id } }).catch(() => {});
        const bankIse1 = await prisma.questionBank.create({
          data: { subjectId, examCycleId: ecIse1.id, phase: QuestionBankPhase.DRAFTING, recordStatus: RecordStatus.ACTIVE, createdById: coordId, pattern: { create: EXAM_TYPE_ISE } },
        }).catch(() => null);
        if (bankIse1) {
          const slotsIse1 = buildSlots(3);
          await prisma.questionSlot.createMany({ data: slotsIse1.map(s => ({ ...s, questionBankId: bankIse1.id })) }).catch(() => {});
          console.log(`  ✅ ${subjCode} ISE-1 bank created (DRAFT)`);
        }
      }

      if (ecIse2) {
        await prisma.subjectExamCycleLink.create({ data: { subjectId, examCycleId: ecIse2.id } }).catch(() => {});
        const bankIse2 = await prisma.questionBank.create({
          data: { subjectId, examCycleId: ecIse2.id, phase: QuestionBankPhase.DRAFTING, recordStatus: RecordStatus.ACTIVE, createdById: coordId, pattern: { create: EXAM_TYPE_ISE2 } },
        }).catch(() => null);
        if (bankIse2) {
          const slotsIse2 = buildSlots(3);
          await prisma.questionSlot.createMany({ data: slotsIse2.map(s => ({ ...s, questionBankId: bankIse2.id })) }).catch(() => {});
          console.log(`  ✅ ${subjCode} ISE-2 bank created (DRAFT)`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. SNAPSHOTS FOR COMPLETED BANKS (legacy snapshots)
  // ═══════════════════════════════════════════════════════════════

  // Create a few REVISION_REQUESTED questions scattered in active banks
  const activeBanks = await prisma.questionBank.findMany({
    where: { recordStatus: RecordStatus.ACTIVE, phase: { in: [QuestionBankPhase.MODERATION, QuestionBankPhase.DRAFTING] } },
    include: { slots: { where: { assignedQuestionId: { not: null } }, take: 5 } },
  });

  for (const bank of activeBanks) {
    for (const slot of bank.slots) {
      if (!slot.assignedQuestionId || Math.random() > 0.3) continue;
      await prisma.questionLibraryItem.update({
        where: { id: slot.assignedQuestionId },
        data: { status: QuestionStatus.REVISION_REQUESTED, moderatorRemark: "Please provide more specific examples and clarify the algorithm steps." },
      }).catch(() => {});
    }
  }

  // ── Notify dean & coe about locked banks ──
  const lockedBanks = await prisma.questionBank.findMany({ where: { recordStatus: RecordStatus.LOCKED }, take: 5 });
  for (const bank of lockedBanks) {
    await prisma.notification.create({
      data: {
        recipientId: deanId, title: "Question Bank Locked",
        message: `A question bank has been locked and is ready for dean review finalization.`,
        type: NotificationType.INFO, actionUrl: `/dashboard/dean/review?bank=${bank.id}`,
      },
    }).catch(() => {});
  }

  const completedBanks = await prisma.questionBank.findMany({ where: { phase: QuestionBankPhase.COMPLETE }, take: 3 });
  for (const bank of completedBanks) {
    await prisma.notification.create({
      data: {
        recipientId: coeId, title: "Exam Papers Ready for Export",
        message: `Papers have been generated and dean-reviewed. Ready for export.`,
        type: NotificationType.SUCCESS, actionUrl: `/dashboard/coe/exports?bank=${bank.id}`,
      },
    }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. SUMMARY
  // ═══════════════════════════════════════════════════════════════

  console.log("\n═══════════════════════════════════════════");
  console.log("🌱 SEED GENERATION COMPLETE — SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`   Academic Years:     3 (2024-25, 2025-26, 2026-27)`);
  console.log(`   Batches:            3 (2023-27, 2024-28, 2025-29)`);
  console.log(`   Subjects:           ${ALL_SUBJECTS.length}`);
  console.log(`   Users:              ${FACULTY.length}`);
  console.log(`   Question Banks:     ${totalBanks} (across 6 semesters)`);
  console.log(`   Questions Created:  ${totalQuestions}`);
  console.log(`   Slots Populated:    ${totalSlots}`);
  console.log(`   Workflow Stages:`);
  console.log(`     • LOCKED/Historical:  BECOMP2023 Sem 3-6, BECOMP2024 Sem 3-4`);
  console.log(`     • APPROVAL Active:    BECOMP2023 Sem 7 (papers pending)`);
  console.log(`     • MODERATION Active:  BECOMP2024 Sem 5`);
  console.log(`     • DRAFTING Active:    BECOMP2025 Sem 3 (ISE + ENDSEM)`);
  console.log("\n📧 All passwords: Password@123");
  console.log("📧 Login: coe@emqpgs.local / coordinator.comp@emqpgs.local / dean@emqpgs.local");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
