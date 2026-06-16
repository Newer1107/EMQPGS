import {
  AcademicYearStatus,
  AiReportStatus,
  CoordinatorDecision,
  CourseOutcome,
  DifficultyLevel,
  ExamCycleStatus,
  ExamType,
  NotificationType,
  PaperGenerationStatus,
  PaperVariant,
  QuestionBankPhase,
  QuestionStatus,
  RbtLevel,
  RecordStatus,
  ReviewStatus,
  Role,
  SemesterType,
  SubjectStatus,
  SubjectVersionStatus,
  UserStatus,
  PrismaClient,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

// ──────────────────────────────────────────────
// 1. Reference data – departments, years, semesters
// ──────────────────────────────────────────────

const DEPARTMENTS = [
  { code: "AIDS", name: "Artificial Intelligence & Data Science", hodName: "Dr. Kavita Sharma" },
  { code: "AIML", name: "Artificial Intelligence & Machine Learning", hodName: "Dr. Rajesh Kumar" },
  { code: "COMP", name: "Computer Engineering", hodName: "Dr. Suresh Patil" },
  { code: "CSEC", name: "Computer Science & Engineering (Cyber Security)", hodName: "Dr. Priya Deshmukh" },
  { code: "CIVL", name: "Civil Engineering", hodName: "Dr. Anand Joshi" },
  { code: "ENCS", name: "Electronics & Computer Science", hodName: "Dr. Meena Iyer" },
  { code: "INFO", name: "Information Technology", hodName: "Dr. Vikram Singh" },
  { code: "IOT", name: "Internet of Things", hodName: "Dr. Neha Gupta" },
  { code: "MME", name: "Mechanical & Manufacturing Engineering", hodName: "Dr. Rohan Bhatt" },
] as const;

const ACADEMIC_YEARS = [
  { code: "2024-2025", startDate: new Date("2024-06-01"), endDate: new Date("2025-05-31"), status: AcademicYearStatus.CLOSED, activeSemesterType: SemesterType.ODD },
  { code: "2025-2026", startDate: new Date("2025-06-01"), endDate: new Date("2026-05-31"), status: AcademicYearStatus.CLOSED, activeSemesterType: SemesterType.EVEN },
  { code: "2026-2027", startDate: new Date("2026-06-01"), endDate: new Date("2027-05-31"), status: AcademicYearStatus.ACTIVE, activeSemesterType: SemesterType.ODD },
] as const;

// ──────────────────────────────────────────────
// 2. Users – real names and institutional emails
// ──────────────────────────────────────────────

const STAFF_NAMES: Record<string, { coordinator: string; moderator: string; contributors: string[] }> = {
  AIDS:  { coordinator: "Dr. Anjali Mehta",     moderator: "Prof. Sameer Kulkarni", contributors: ["Ms. Pooja Desai", "Mr. Harsh Vardhan", "Ms. Sneha Rao"] },
  AIML:  { coordinator: "Dr. Nikhil Joshi",     moderator: "Prof. Deepali Shah",    contributors: ["Mr. Rohan Mhatre", "Ms. Aditi Pandey", "Mr. Kunal Patil"] },
  COMP:  { coordinator: "Dr. Amol Kulkarni",    moderator: "Prof. Shweta Jadhav",   contributors: ["Mr. Abhishek Gupta", "Ms. Rupali Singh", "Mr. Siddharth Nair"] },
  CSEC:  { coordinator: "Dr. Rucha Deshpande",  moderator: "Prof. Manoj Tiwari",    contributors: ["Ms. Tanvi Shah", "Mr. Varun Saxena", "Ms. Neelam Mishra"] },
  CIVL:  { coordinator: "Dr. Prakash Rao",      moderator: "Prof. Sunita Kale",     contributors: ["Mr. Dinesh Yadav", "Ms. Swati Joshi", "Mr. Akash Thakur"] },
  ENCS:  { coordinator: "Dr. Shilpa Agarwal",   moderator: "Prof. Karan Mehta",     contributors: ["Mr. Pranav Shetty", "Ms. Nidhi Bhat", "Mr. Chetan Pawar"] },
  INFO:  { coordinator: "Dr. Milind Kulkarni",  moderator: "Prof. Ashwini Kamat",   contributors: ["Ms. Rutuja Patil", "Mr. Omkar Gokhale", "Ms. Kirti Jain"] },
  IOT:   { coordinator: "Dr. Soham Engineer",   moderator: "Prof. Uma Shankar",     contributors: ["Mr. Vishal More", "Ms. Prajakta Joshi", "Mr. Aditya Sawant"] },
  MME:   { coordinator: "Dr. Arvind Desai",     moderator: "Prof. Lata Mahajan",    contributors: ["Mr. Sumit Bansal", "Ms. Ritu Agarwal", "Mr. Hitesh Verma"] },
} as const;

// ──────────────────────────────────────────────
// 3. Subjects per department × semester
// ──────────────────────────────────────────────

type SubjectDef = { code: string; name: string; credits: number; semNumber: number; syllabus: string };
type DeptSubjectMap = Record<string, SubjectDef[]>;

const SUBJECTS: DeptSubjectMap = {
  AIDS: [
    { code: "AIDS101", name: "Mathematics I",          credits: 4, semNumber: 1, syllabus: "Linear algebra, calculus, probability" },
    { code: "AIDS102", name: "Python Programming",      credits: 4, semNumber: 1, syllabus: "Python fundamentals, data structures, OOP" },
    { code: "AIDS201", name: "Data Structures",         credits: 4, semNumber: 3, syllabus: "Arrays, linked lists, trees, graphs, hash tables" },
    { code: "AIDS202", name: "Database Management Systems", credits: 4, semNumber: 3, syllabus: "ER modeling, SQL, normalization, transactions" },
    { code: "AIDS301", name: "Machine Learning",        credits: 4, semNumber: 5, syllabus: "Supervised, unsupervised, regression, classification, neural networks" },
    { code: "AIDS302", name: "Big Data Analytics",      credits: 3, semNumber: 5, syllabus: "Hadoop, Spark, MapReduce, data warehousing" },
    { code: "AIDS401", name: "Deep Learning",           credits: 4, semNumber: 7, syllabus: "CNNs, RNNs, transformers, GANs, tensorflow" },
    { code: "AIDS402", name: "Data Mining",             credits: 3, semNumber: 7, syllabus: "Clustering, association rules, anomaly detection" },
  ],
  AIML: [
    { code: "AIML101", name: "Mathematics I",           credits: 4, semNumber: 1, syllabus: "Linear algebra, calculus, probability" },
    { code: "AIML102", name: "Python Programming",      credits: 4, semNumber: 1, syllabus: "Python fundamentals, data structures, OOP" },
    { code: "AIML201", name: "Machine Learning",        credits: 4, semNumber: 3, syllabus: "Supervised, unsupervised, regression, SVMs" },
    { code: "AIML202", name: "Statistics for AI",       credits: 3, semNumber: 3, syllabus: "Descriptive stats, hypothesis testing, Bayesian inference" },
    { code: "AIML301", name: "Neural Networks",         credits: 4, semNumber: 5, syllabus: "Perceptron, backpropagation, CNNs, RNNs" },
    { code: "AIML302", name: "Reinforcement Learning",  credits: 3, semNumber: 5, syllabus: "MDPs, Q-learning, policy gradients, deep RL" },
    { code: "AIML401", name: "Computer Vision",         credits: 4, semNumber: 7, syllabus: "Image processing, object detection, segmentation, CNNs" },
    { code: "AIML402", name: "Natural Language Processing", credits: 3, semNumber: 7, syllabus: "Tokenization, embeddings, transformers, BERT, LLMs" },
  ],
  COMP: [
    { code: "COM101", name: "Data Structures",          credits: 4, semNumber: 3, syllabus: "Arrays, linked lists, stacks, queues, trees, graphs" },
    { code: "COM102", name: "Discrete Mathematics",     credits: 4, semNumber: 3, syllabus: "Set theory, logic, combinatorics, graph theory" },
    { code: "COM201", name: "Operating Systems",        credits: 4, semNumber: 5, syllabus: "Process management, memory management, file systems, IPC" },
    { code: "COM202", name: "Database Management Systems", credits: 4, semNumber: 5, syllabus: "ER modeling, SQL, normalization, transactions, indexing" },
    { code: "COM301", name: "Computer Networks",        credits: 4, semNumber: 7, syllabus: "TCP/IP, routing, transport layer, application protocols" },
    { code: "COM302", name: "Compiler Design",          credits: 4, semNumber: 7, syllabus: "Lexical analysis, parsing, semantic analysis, code generation" },
  ],
  CSEC: [
    { code: "CSE101", name: "Cryptography",             credits: 4, semNumber: 3, syllabus: "Symmetric/Asymmetric crypto, AES, RSA, hash functions" },
    { code: "CSE102", name: "Network Security",         credits: 4, semNumber: 3, syllabus: "Firewalls, IDS, VPNs, secure protocols, TLS" },
    { code: "CSE201", name: "Ethical Hacking",          credits: 4, semNumber: 5, syllabus: "Reconnaissance, exploitation, web app testing, reporting" },
    { code: "CSE202", name: "Digital Forensics",        credits: 3, semNumber: 5, syllabus: "Evidence collection, disk forensics, memory analysis, chain of custody" },
    { code: "CSE301", name: "Malware Analysis",         credits: 4, semNumber: 7, syllabus: "Static/dynamic analysis, reverse engineering, packers" },
    { code: "CSE302", name: "Secure Coding Practices",  credits: 3, semNumber: 7, syllabus: "Input validation, OWASP Top 10, SAST, DAST" },
  ],
  CIVL: [
    { code: "CIV101", name: "Surveying",                credits: 4, semNumber: 3, syllabus: "Leveling, theodolite, total station, GPS" },
    { code: "CIV201", name: "Structural Analysis",      credits: 4, semNumber: 5, syllabus: "Beams, trusses, frames, moment distribution" },
    { code: "CIV301", name: "Reinforced Concrete Design", credits: 4, semNumber: 7, syllabus: "Limit state method, beams, slabs, columns, footings" },
    { code: "CIV302", name: "Transportation Engineering", credits: 3, semNumber: 7, syllabus: "Highway design, traffic engineering, pavement materials" },
  ],
  ENCS: [
    { code: "ENC101", name: "Circuit Theory",           credits: 4, semNumber: 3, syllabus: "Network theorems, transient analysis, AC circuits" },
    { code: "ENC102", name: "Digital Electronics",      credits: 4, semNumber: 3, syllabus: "Logic gates, flip-flops, counters, multiplexers" },
    { code: "ENC201", name: "Microprocessors",          credits: 4, semNumber: 5, syllabus: "8086 architecture, instruction set, interrupts, interfacing" },
    { code: "ENC301", name: "VLSI Design",              credits: 4, semNumber: 7, syllabus: "CMOS logic, layout design, HDL, verification" },
  ],
  INFO: [
    { code: "INF101", name: "Web Technologies",         credits: 4, semNumber: 3, syllabus: "HTML, CSS, JavaScript, React, Node.js" },
    { code: "INF201", name: "Cloud Computing",          credits: 4, semNumber: 5, syllabus: "IaaS/PaaS/SaaS, AWS, Docker, Kubernetes" },
    { code: "INF202", name: "DevOps",                   credits: 3, semNumber: 5, syllabus: "CI/CD, Git, Jenkins, Ansible, monitoring" },
    { code: "INF301", name: "Information Security",     credits: 4, semNumber: 7, syllabus: "Risk management, compliance, security policies, audits" },
  ],
  IOT: [
    { code: "IOT101", name: "Embedded Systems",         credits: 4, semNumber: 3, syllabus: "ARM microcontrollers, GPIO, timers, RTOS" },
    { code: "IOT102", name: "Sensors & Actuators",      credits: 3, semNumber: 3, syllabus: "Temperature, pressure, motion sensors, motor control" },
    { code: "IOT201", name: "Industrial IoT",           credits: 4, semNumber: 5, syllabus: "SCADA, MQTT, OPC-UA, digital twins" },
    { code: "IOT301", name: "Edge Computing",           credits: 4, semNumber: 7, syllabus: "Edge architectures, AWS Greengrass, Fog computing" },
  ],
  MME: [
    { code: "MME101", name: "Engineering Mechanics",      credits: 4, semNumber: 3, syllabus: "Statics, dynamics, friction, moment of inertia" },
    { code: "MME201", name: "Manufacturing Processes",    credits: 4, semNumber: 5, syllabus: "Casting, forming, welding, machining" },
    { code: "MME301", name: "CAD/CAM",                    credits: 4, semNumber: 7, syllabus: "Solid modeling, CNC programming, simulation" },
    { code: "MME302", name: "Material Science",           credits: 3, semNumber: 7, syllabus: "Phase diagrams, heat treatment, composites" },
  ],
};

// ──────────────────────────────────────────────
// 4. Realistic questions per subject
// ──────────────────────────────────────────────

type QuestionDef = {
  text: string;
  module: number;
  marks: number;
  co: CourseOutcome;
  rbt: RbtLevel;
  difficulty: DifficultyLevel;
};

const QUESTIONS: Record<string, QuestionDef[]> = {
  "Machine Learning": [
    { text: "Explain the bias-variance tradeoff in machine learning models.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare supervised and unsupervised learning with two examples each.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "Define supervised learning.", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Derive the equation for linear regression using the least squares method.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L5, difficulty: DifficultyLevel.HARD },
    { text: "What is gradient descent? Explain batch and stochastic variants.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "List the assumptions of linear regression.", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Implement the k-nearest neighbors algorithm from scratch.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "Explain how the confusion matrix is used to evaluate classification models.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is the difference between precision and recall?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.EASY },
    { text: "Describe the architecture of a decision tree and how it splits nodes.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare bagging and boosting ensemble methods.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L4, difficulty: DifficultyLevel.HARD },
    { text: "Define entropy in the context of decision trees.", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the kernel trick and its role in SVMs.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Derive the dual formulation of a support vector machine.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L5, difficulty: DifficultyLevel.HARD },
    { text: "What is a support vector?", module: 5, marks: 2, co: CourseOutcome.CO5, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the k-means clustering algorithm step by step.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare hierarchical clustering with k-means, discussing strengths and weaknesses.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L4, difficulty: DifficultyLevel.HARD },
    { text: "What is the elbow method in clustering?", module: 6, marks: 2, co: CourseOutcome.CO6, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
  ],
  "Operating Systems": [
    { text: "Explain the difference between process and thread.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe the five-state process model with a state transition diagram.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a process control block?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the banker's algorithm for deadlock avoidance.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L3, difficulty: DifficultyLevel.HARD },
    { text: "What are the four necessary conditions for deadlock?", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.MEDIUM },
    { text: "Define deadlock.", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Compare paging and segmentation in memory management.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the LRU page replacement algorithm with an example.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L3, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a page fault?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the SCAN and C-SCAN disk scheduling algorithms.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Calculate the total seek time for SSTF given a request queue.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L3, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is seek time?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the Producer-Consumer problem and its solution using semaphores.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L4, difficulty: DifficultyLevel.HARD },
    { text: "What is a semaphore? Describe wait and signal operations.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Define mutual exclusion.", module: 5, marks: 2, co: CourseOutcome.CO5, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Compare contiguous and linked file allocation strategies.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe the Unix inode structure in detail.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a file descriptor?", module: 6, marks: 2, co: CourseOutcome.CO6, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
  ],
  "Data Structures": [
    { text: "Explain the difference between an array and a linked list.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Implement a function to reverse a singly linked list.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "What is a linked list?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe stack operations and their time complexities.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Evaluate the postfix expression 5 3 + 8 * using a stack.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L3, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a stack?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain BFS traversal of a graph with an example.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Implement Dijkstra's shortest path algorithm for a weighted graph.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "What is a graph?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the properties of a binary search tree.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Write a function to delete a node from a BST and maintain the BST property.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "What is a binary tree?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Compare linear and binary search algorithms.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "Implement quicksort and analyze its worst-case time complexity.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "What is time complexity?", module: 5, marks: 2, co: CourseOutcome.CO5, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain separate chaining for collision resolution in hash tables.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Design a hash table with open addressing and quadratic probing.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "What is a hash function?", module: 6, marks: 2, co: CourseOutcome.CO6, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
  ],
  "Computer Networks": [
    { text: "Explain the OSI model layers and their functions.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare OSI and TCP/IP reference models.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a protocol?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the TCP three-way handshake with a timing diagram.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the difference between TCP and UDP.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a port number?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the distance vector routing algorithm.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare distance vector and link state routing protocols.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L4, difficulty: DifficultyLevel.HARD },
    { text: "What is a routing table?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain CSMA/CD and how it handles collisions in Ethernet.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Design a subnet mask scheme for a network with 4 subnets of 50 hosts each.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "What is a MAC address?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe how DNS resolves a domain name to an IP address.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the HTTP request-response cycle with headers.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is HTTP?", module: 5, marks: 2, co: CourseOutcome.CO5, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe SSL/TLS handshake protocol.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare symmetric and asymmetric encryption in network security.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L4, difficulty: DifficultyLevel.HARD },
    { text: "What is encryption?", module: 6, marks: 2, co: CourseOutcome.CO6, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
  ],
  "Database Management Systems": [
    { text: "Explain the three-schema architecture of a DBMS.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe the entity-relationship model with an example.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a primary key?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Write SQL queries to perform inner join, left join, and right join.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L3, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the difference between WHERE and HAVING clauses.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a foreign key?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the first, second, and third normal forms with examples.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the concept of functional dependency.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is normalization?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain ACID properties of database transactions.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe the two-phase locking protocol for concurrency control.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.HARD },
    { text: "What is a transaction?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain B-tree indexing and its advantage over B+ trees.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Design a query execution plan for a complex join query.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "What is an index?", module: 5, marks: 2, co: CourseOutcome.CO5, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe optimistic and pessimistic concurrency control.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the ARIES recovery algorithm.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.HARD },
    { text: "What is a deadlock in databases?", module: 6, marks: 2, co: CourseOutcome.CO6, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
  ],
  "Compiler Design": [
    { text: "Explain the phases of a compiler with a block diagram.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Differentiate between compiler and interpreter.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a compiler?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Write a regular expression for identifiers in C and construct its NFA.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "Explain the role of a lexical analyzer.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a token?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Construct an LL(1) parsing table for a given grammar.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "Explain recursive descent parsing with an example.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a grammar?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the syntax-directed translation for infix to postfix conversion.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the role of an intermediate code generator.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is three-address code?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain code optimization techniques with examples.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is constant folding in optimization?", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the target code generation phase using register allocation.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain graph coloring for register allocation.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
  ],
  "Ethical Hacking": [
    { text: "Describe the five phases of ethical hacking methodology.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Differentiate between white-box and black-box testing.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is ethical hacking?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the steps involved in reconnaissance and footprinting.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Use Nmap to perform a stealth SYN scan and interpret the results.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L3, difficulty: DifficultyLevel.HARD },
    { text: "What is a port scan?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe SQL injection attacks and mitigation techniques.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.HARD },
    { text: "Explain stored and reflected XSS with examples.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is cross-site scripting?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Design a password cracking prevention strategy using salting and hashing.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "Explain ARP poisoning and how to detect it on a network.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is ARP?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the steps to write a penetration testing report.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Create a security assessment checklist for a web application.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L6, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe wireless network sniffing techniques using tools like Aircrack-ng.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain how to conduct a WPA2 handshake capture and crack it.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L3, difficulty: DifficultyLevel.HARD },
  ],
  "Cryptography": [
    { text: "Explain the Caesar cipher and its cryptanalysis.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare symmetric and asymmetric key cryptography.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is cryptography?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the Data Encryption Standard (DES) algorithm structure.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the Feistel cipher structure.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a block cipher?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the AES encryption algorithm rounds and key expansion.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.HARD },
    { text: "Compare ECB, CBC, CFB, and OFB modes of operation.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is AES?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the RSA algorithm with a numerical example.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L3, difficulty: DifficultyLevel.HARD },
    { text: "Describe the Diffie-Hellman key exchange protocol.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a public key?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the SHA-256 hashing algorithm and its applications.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare MD5 and SHA-512 in terms of security and performance.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a hash function?", module: 5, marks: 2, co: CourseOutcome.CO5, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the structure of a digital certificate following X.509 standard.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe the PKI architecture and its components.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a digital signature?", module: 6, marks: 2, co: CourseOutcome.CO6, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
  ],
  "Big Data Analytics": [
    { text: "Explain the 5 Vs of big data.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe the Hadoop ecosystem components.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is big data?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the MapReduce programming model with a word count example.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe HDFS architecture and data replication.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is HDFS?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain Spark RDD operations with transformations and actions.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare Spark and Hadoop MapReduce.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L4, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is Apache Spark?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the architecture of Hive and its query execution.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Write HiveQL queries for data aggregation and filtering.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L3, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a data warehouse?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the CAP theorem and its implications for NoSQL databases.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare Cassandra and MongoDB in terms of data model and consistency.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L4, difficulty: DifficultyLevel.HARD },
    { text: "Explain the concepts of data streaming with Kafka.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Design a real-time data pipeline using Kafka and Spark Streaming.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
  ],
  "Deep Learning": [
    { text: "Explain the architecture of a feedforward neural network.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Derive the backpropagation algorithm with gradient descent.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L5, difficulty: DifficultyLevel.HARD },
    { text: "What is a perceptron?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the architecture of a Convolutional Neural Network.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the role of pooling layers in CNNs.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a filter in CNNs?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the LSTM architecture and its advantage over vanilla RNNs.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.HARD },
    { text: "Describe the vanishing gradient problem and its solutions.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is an RNN?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the Transformer architecture with self-attention mechanism.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.HARD },
    { text: "Describe how BERT is trained using masked language modeling.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is attention in deep learning?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain the architecture of Generative Adversarial Networks.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.HARD },
    { text: "Describe transfer learning and its applications in computer vision.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is a GAN?", module: 5, marks: 2, co: CourseOutcome.CO5, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
  ],
  "Data Mining": [
    { text: "Explain the KDD process in data mining.", module: 1, marks: 5, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe the Apriori algorithm for frequent itemset mining.", module: 1, marks: 10, co: CourseOutcome.CO1, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "What is data mining?", module: 1, marks: 2, co: CourseOutcome.CO1, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Calculate support and confidence for a given association rule.", module: 2, marks: 5, co: CourseOutcome.CO2, rbt: RbtLevel.L3, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain the FP-Growth algorithm and its advantages over Apriori.", module: 2, marks: 10, co: CourseOutcome.CO2, rbt: RbtLevel.L2, difficulty: DifficultyLevel.HARD },
    { text: "What is an association rule?", module: 2, marks: 2, co: CourseOutcome.CO2, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Describe the DBSCAN clustering algorithm.", module: 3, marks: 5, co: CourseOutcome.CO3, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Compare k-means and DBSCAN clustering with appropriate use cases.", module: 3, marks: 10, co: CourseOutcome.CO3, rbt: RbtLevel.L4, difficulty: DifficultyLevel.HARD },
    { text: "What is clustering?", module: 3, marks: 2, co: CourseOutcome.CO3, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain techniques for detecting outliers in datasets.", module: 4, marks: 5, co: CourseOutcome.CO4, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Design a fraud detection system using anomaly detection.", module: 4, marks: 10, co: CourseOutcome.CO4, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
    { text: "What is an outlier?", module: 4, marks: 2, co: CourseOutcome.CO4, rbt: RbtLevel.L1, difficulty: DifficultyLevel.EASY },
    { text: "Explain decision tree induction with the ID3 algorithm.", module: 5, marks: 5, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Describe data preprocessing steps for mining.", module: 5, marks: 10, co: CourseOutcome.CO5, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Explain web mining and its categories.", module: 6, marks: 5, co: CourseOutcome.CO6, rbt: RbtLevel.L2, difficulty: DifficultyLevel.MEDIUM },
    { text: "Design a recommendation system using collaborative filtering.", module: 6, marks: 10, co: CourseOutcome.CO6, rbt: RbtLevel.L6, difficulty: DifficultyLevel.HARD },
  ],
};

function getQuestionsForSubject(subjectName: string): QuestionDef[] {
  return QUESTIONS[subjectName] ?? [];
}

// ──────────────────────────────────────────────
// 5. Slots from off-the-shelf pattern (6×3×7)
// ──────────────────────────────────────────────

function generateSlots(bankId: string) {
  const slots: Array<{ questionBankId: string; moduleNumber: number; marks: number; slotNumber: number }> = [];
  for (let m = 1; m <= 6; m++) {
    for (const mk of [2, 5, 10]) {
      for (let s = 1; s <= 7; s++) {
        slots.push({ questionBankId: bankId, moduleNumber: m, marks: mk, slotNumber: s });
      }
    }
  }
  return slots;
}

// ──────────────────────────────────────────────
// 6. Deterministic "random" helpers
//    (seed produces the same data every run)
// ──────────────────────────────────────────────

function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const result = [...arr];
  let m = result.length;
  let s = seed;
  while (m) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const i = s % m--;
    [result[m], result[i]] = [result[i], result[m]];
  }
  return result;
}

// ──────────────────────────────────────────────
// 7. MAIN SEED
// ──────────────────────────────────────────────

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    console.error("\n⚠️  Refusing to seed in production.\n");
    console.error("  Set ALLOW_PRODUCTION_SEED=true to override this guard.\n");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // ---------- DEPARTMENTS ----------
  const depts = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const rec = await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: { name: d.name, code: d.code, hodName: d.hodName },
    });
    depts.set(d.code, rec.id);
  }

  // ---------- ACADEMIC YEARS (auto-generates 8 semesters each) ----------
  const years = new Map<string, string>();
  const semNumberToId = new Map<number, string>();
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
  for (const y of ACADEMIC_YEARS) {
    const rec = await prisma.academicYear.upsert({
      where: { code: y.code },
      update: { activeSemesterType: y.activeSemesterType },
      create: {
        code: y.code,
        startDate: y.startDate,
        endDate: y.endDate,
        status: y.status,
        activeSemesterType: y.activeSemesterType,
      },
    });
    years.set(y.code, rec.id);

    const existing = await prisma.semester.count({ where: { academicYearId: rec.id } });
    if (existing === 0) {
      await prisma.semester.createMany({
        data: Array.from({ length: 8 }, (_, i) => ({
          number: i + 1,
          name: `Semester ${ROMAN[i]}`,
          academicYearId: rec.id,
        })),
      });
    }

    const sems = await prisma.semester.findMany({
      where: { academicYearId: rec.id },
      orderBy: { number: "asc" },
    });
    for (const s of sems) {
      semNumberToId.set(s.number, s.id);
    }
  }

  // ---------- USERS ----------
  const users = new Map<string, string>();

  // COE
  const coe = await prisma.user.upsert({
    where: { email: "coe@emqpgs.local" },
    update: {},
    create: {
      name: "Dr. Mahesh Kulkarni",
      email: "coe@emqpgs.local",
      role: Role.COE,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });
  users.set("COE", coe.id);

  // Dean
  const dean = await prisma.user.upsert({
    where: { email: "dean@emqpgs.local" },
    update: {},
    create: {
      name: "Dr. Sunita Deshmukh",
      email: "dean@emqpgs.local",
      role: Role.DEAN,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });
  users.set("DEAN", dean.id);

  // Per-department users
  const deptCoordinators = new Map<string, string>();
  const deptModerators = new Map<string, string>();
  const deptContributors = new Map<string, string[]>();

  for (const [code, staff] of Object.entries(STAFF_NAMES)) {
    const deptId = depts.get(code)!;
    const domain = "emqpgs.local";

    // Coordinator
    const coordEmail = `coordinator.${code.toLowerCase()}@${domain}`;
    const coord = await prisma.user.upsert({
      where: { email: coordEmail },
      update: {},
      create: {
        name: staff.coordinator,
        email: coordEmail,
        role: Role.COORDINATOR,
        passwordHash,
        status: UserStatus.ACTIVE,
        departmentId: deptId,
      },
    });
    users.set(`COORD_${code}`, coord.id);
    deptCoordinators.set(code, coord.id);

    // Moderator
    const modEmail = `moderator.${code.toLowerCase()}@${domain}`;
    const mod = await prisma.user.upsert({
      where: { email: modEmail },
      update: {},
      create: {
        name: staff.moderator,
        email: modEmail,
        role: Role.MODERATOR,
        passwordHash,
        status: UserStatus.ACTIVE,
        departmentId: deptId,
      },
    });
    users.set(`MOD_${code}`, mod.id);
    deptModerators.set(code, mod.id);

    // Contributors (3 each)
    const contribIds: string[] = [];
    for (let i = 0; i < staff.contributors.length; i++) {
      const contribEmail = `contributor${i + 1}.${code.toLowerCase()}@${domain}`;
      const contrib = await prisma.user.upsert({
        where: { email: contribEmail },
        update: {},
        create: {
          name: staff.contributors[i],
          email: contribEmail,
          role: Role.CONTRIBUTOR,
          passwordHash,
          status: UserStatus.ACTIVE,
          departmentId: deptId,
        },
      });
      users.set(`CONTRIB_${code}_${i + 1}`, contrib.id);
      contribIds.push(contrib.id);
    }
    deptContributors.set(code, contribIds);
  }

  // ---------- COORDINATOR-DEPARTMENT ASSIGNMENTS ----------
  for (const [code, coordId] of Array.from(deptCoordinators)) {
    const deptId = depts.get(code)!;
    await prisma.coordinatorDepartmentAssignment.upsert({
      where: { coordinatorId_departmentId: { coordinatorId: coordId, departmentId: deptId } },
      update: {},
      create: { coordinatorId: coordId, departmentId: deptId },
    });
  }

  // ---------- SUBJECTS + VERSIONS ----------
  const subjectIds = new Map<string, string>(); // subjectCode -> id
  const svIds = new Map<string, string>(); // subjectCode -> latest subjectVersion id

  for (const [deptCode, subjectList] of Object.entries(SUBJECTS)) {
    const deptId = depts.get(deptCode)!;
    for (const subj of subjectList) {
      const dbSubject = await prisma.subject.upsert({
        where: { subjectCode_departmentId: { subjectCode: subj.code, departmentId: deptId } },
        update: {},
        create: {
          subjectCode: subj.code,
          subjectName: subj.name,
          credits: subj.credits,
          status: SubjectStatus.ACTIVE,
          questionBankDueDate: new Date("2026-08-15"),
          departmentId: deptId,
          semesterNumber: subj.semNumber,
        },
      });
      subjectIds.set(subj.code, dbSubject.id);

      // SubjectVersion
      const sv = await prisma.subjectVersion.upsert({
        where: { subjectId_versionNumber: { subjectId: dbSubject.id, versionNumber: 1 } },
        update: {},
        create: {
          subjectId: dbSubject.id,
          versionNumber: 1,
          title: subj.name,
          syllabusDescription: subj.syllabus,
          effectiveFromAcademicYearId: years.get("2026-2027")!,
          status: SubjectVersionStatus.ACTIVE,
        },
      });
      svIds.set(subj.code, sv.id);
    }
  }

  // ---------- EXAM CYCLES (2026-2027, Sem III/V/VII, ENDSEM) ----------
  // Each department gets its own cycle, scoped by (semesterId, examType, departmentId).
  const TARGET_SEMESTERS = [3, 5, 7];
  const currentYearId = years.get("2026-2027")!;
  const cycleIds: string[] = [];
  const existingCycles = new Map<string, string>();

  for (const deptCode of Object.keys(STAFF_NAMES)) {
    for (const semNum of TARGET_SEMESTERS) {
      const semId = semNumberToId.get(semNum);
      if (!semId) continue;
      const deptId = depts.get(deptCode)!;

      const cycle = await prisma.examCycle.upsert({
        where: {
          semesterId_examType_departmentId: {
            semesterId: semId,
            examType: ExamType.ENDSEM,
            departmentId: deptId,
          },
        },
        update: {},
        create: {
          examType: ExamType.ENDSEM,
          status: ExamCycleStatus.ACTIVE,
          startDate: new Date("2026-11-01"),
          endDate: new Date("2026-11-30"),
          departmentId: deptId,
          academicYearId: currentYearId,
          semesterId: semId,
          timetableDocumentRef: `TCET/EXAM/${deptCode}-${semNum}-ENDSEM-2026`,
          timetableIssueDate: new Date("2026-10-15"),
          timetableTitle: `End Semester Examinations ${deptCode} Sem ${semNum} Nov 2026`,
          timetableRows: JSON.stringify([
            { dateDay: "2026-11-15 Monday", time: "10:30 AM - 1:30 PM", paper: "Paper 1" },
            { dateDay: "2026-11-17 Wednesday", time: "10:30 AM - 1:30 PM", paper: "Paper 2" },
            { dateDay: "2026-11-19 Friday", time: "10:30 AM - 1:30 PM", paper: "Paper 3" },
          ]),
          timetableSignature: "Controller of Examinations",
        },
      });
      cycleIds.push(cycle.id);
      existingCycles.set(`${deptCode}-${semNum}`, cycle.id);

      // Link subjects to this cycle
      const deptSubjects = SUBJECTS[deptCode]?.filter((s) => s.semNumber === semNum) ?? [];
      for (const subj of deptSubjects) {
        const subjId = subjectIds.get(subj.code);
        if (!subjId) continue;
        await prisma.subjectExamCycleLink.upsert({
          where: { subjectId_examCycleId: { subjectId: subjId, examCycleId: cycle.id } },
          update: {},
          create: { subjectId: subjId, examCycleId: cycle.id },
        });
      }
    }
  }

  // ---------- QUESTION BANKS ----------
  // Strategy per department to create varied operational states:
  const BANK_STRATEGIES: Record<string, "full" | "drafting" | "moderation" | "approval" | "complete"> = {
    COMP: "complete",
    CSEC: "approval",
    AIDS: "moderation",
    AIML: "full",
    CIVL: "drafting",
    ENCS: "full",
    INFO: "moderation",
    IOT: "drafting",
    MME: "full",
  };

  const allBanks: Array<{
    id: string;
    deptCode: string;
    semNum: number;
    phase: QuestionBankPhase;
    recordStatus: RecordStatus;
    strategy: string;
  }> = [];

  for (const deptCode of Object.keys(STAFF_NAMES)) {
    const strategy = BANK_STRATEGIES[deptCode] ?? "full";
    const coordinatorId = deptCoordinators.get(deptCode)!;
    const deptId = depts.get(deptCode)!;

    for (const semNum of TARGET_SEMESTERS) {
      const cycleId = existingCycles.get(`${deptCode}-${semNum}`);
      if (!cycleId) continue;

      const deptSubjects = SUBJECTS[deptCode]?.filter((s) => s.semNumber === semNum) ?? [];
      for (const subj of deptSubjects) {
        const subjId = subjectIds.get(subj.code);
        if (!subjId) continue;

        const bank = await prisma.questionBank.upsert({
          where: { subjectId_examCycleId: { subjectId: subjId, examCycleId: cycleId } },
          update: {},
          create: {
            subjectId: subjId,
            examCycleId: cycleId,
            phase: QuestionBankPhase.DRAFTING,
            recordStatus: RecordStatus.ACTIVE,
            createdById: coordinatorId,
          },
        });

        // Paper pattern
        await prisma.paperPattern.upsert({
          where: { questionBankId: bank.id },
          update: {},
          create: {
            questionBankId: bank.id,
            examType: ExamType.ENDSEM,
            totalModules: 6,
            marksPattern: [2, 5, 10],
            slotsPerModule: 7,
            totalSlots: 126,
          },
        });

        // Slots
        const slots = generateSlots(bank.id);
        await prisma.questionSlot.createMany({ data: slots, skipDuplicates: true });

        // Moderator assignment
        const modId = deptModerators.get(deptCode)!;
        await prisma.moderatorBankAssignment.upsert({
          where: { moderatorId_questionBankId: { moderatorId: modId, questionBankId: bank.id } },
          update: {},
          create: { moderatorId: modId, questionBankId: bank.id },
        });

        allBanks.push({ id: bank.id, deptCode, semNum, phase: QuestionBankPhase.DRAFTING, recordStatus: RecordStatus.ACTIVE, strategy });
      }
    }
  }

  // ---------- QUESTIONS + SLOT ASSIGNMENTS ----------
  // Phase 1: create questions, assign to slots, set status
  // Phase 2: advance phases according to strategy

  const questionIds: string[] = [];

  for (const bank of allBanks) {
    const deptSubjects = SUBJECTS[bank.deptCode]?.filter((s) => s.semNumber === bank.semNum) ?? [];
    for (const subj of deptSubjects) {
      const svId = svIds.get(subj.code);
      if (!svId) continue;

      const questionsDef = getQuestionsForSubject(subj.name);
      if (questionsDef.length === 0) continue;

      // Determine fill rate based on strategy
      let fillRate = 0.5;
      let approvalRate = 0.6;
      let revisionRate = 0.1;
      if (bank.strategy === "complete") { fillRate = 0.95; approvalRate = 0.95; revisionRate = 0.0; }
      else if (bank.strategy === "approval") { fillRate = 0.85; approvalRate = 0.8; revisionRate = 0.05; }
      else if (bank.strategy === "moderation") { fillRate = 0.75; approvalRate = 0.5; revisionRate = 0.1; }
      else if (bank.strategy === "drafting") { fillRate = 0.4; approvalRate = 0.2; revisionRate = 0.05; }
      else if (bank.strategy === "full") { fillRate = 0.6; approvalRate = 0.7; revisionRate = 0.05; }

      // Shuffle questions to distribute across modules
      const shuffled = seededShuffle(questionsDef, subj.code.length * 31 + bank.semNum * 7);

      // Get all slots for this bank
      const bankSlots = await prisma.questionSlot.findMany({
        where: { questionBankId: bank.id },
        orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
      });

      const slotsToFill = Math.ceil(bankSlots.length * fillRate);
      const assignableSlots = seededShuffle(bankSlots, subj.code.length * 17 + bank.semNum * 13);
      const contributors = deptContributors.get(bank.deptCode) ?? [];
      const creatorId = contributors.length > 0 ? contributors[0] : deptCoordinators.get(bank.deptCode)!;

      for (let i = 0; i < Math.min(slotsToFill, shuffled.length); i++) {
        const qDef = shuffled[i];
        const slot = assignableSlots[i % assignableSlots.length];

        // Determine question status
        let qStatus: QuestionStatus;
        const roll = ((qDef.text.length * 7 + i * 13) % 100) / 100;
        if (bank.strategy === "complete" || bank.strategy === "approval") {
          if (roll < approvalRate) qStatus = QuestionStatus.APPROVED;
          else if (roll < approvalRate + revisionRate) qStatus = QuestionStatus.REVISION_REQUESTED;
          else qStatus = QuestionStatus.REJECTED;
        } else if (bank.strategy === "moderation") {
          if (roll < 0.3) qStatus = QuestionStatus.APPROVED;
          else if (roll < 0.55) qStatus = QuestionStatus.PENDING;
          else if (roll < 0.8) qStatus = QuestionStatus.REVISION_REQUESTED;
          else qStatus = QuestionStatus.REJECTED;
        } else if (bank.strategy === "drafting") {
          if (roll < 0.3) qStatus = QuestionStatus.PENDING;
          else if (roll < 0.5) qStatus = QuestionStatus.DRAFT;
          else if (roll < 0.7) qStatus = QuestionStatus.APPROVED;
          else if (roll < 0.85) qStatus = QuestionStatus.REVISION_REQUESTED;
          else qStatus = QuestionStatus.REJECTED;
        } else {
          if (roll < 0.4) qStatus = QuestionStatus.APPROVED;
          else if (roll < 0.65) qStatus = QuestionStatus.PENDING;
          else if (roll < 0.8) qStatus = QuestionStatus.DRAFT;
          else if (roll < 0.9) qStatus = QuestionStatus.REVISION_REQUESTED;
          else qStatus = QuestionStatus.REJECTED;
        }

        const question = await prisma.questionLibraryItem.upsert({
          where: {
            id: `${bank.id}-${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`,
          },
          update: {},
          create: {
            id: `${bank.id}-${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`,
            subjectVersionId: svId,
            moduleNumber: slot.moduleNumber,
            marks: slot.marks,
            questionText: qDef.text,
            coMapping: qDef.co,
            rbtLevel: qDef.rbt,
            difficultyLevel: qDef.difficulty,
            teachingIndex: `TI-${subj.code}-M${slot.moduleNumber}`,
            status: qStatus,
            createdById: creatorId,
            ownerId: creatorId,
            submittedAt: qStatus !== QuestionStatus.DRAFT ? new Date("2026-09-01") : undefined,
            reviewedAt: qStatus === QuestionStatus.APPROVED || qStatus === QuestionStatus.REJECTED ? new Date("2026-09-15") : undefined,
          },
        });
        questionIds.push(question.id);

        // Assign to slot
        await prisma.questionSlot.update({
          where: { id: slot.id },
          data: { assignedQuestionId: question.id },
        });

        // Revision for initial creation
        await prisma.questionRevision.upsert({
          where: { questionId_revisionNumber: { questionId: question.id, revisionNumber: 1 } },
          update: {},
          create: {
            questionId: question.id,
            revisionNumber: 1,
            snapshotQuestionText: question.questionText,
            snapshotModule: question.moduleNumber,
            snapshotMarks: question.marks,
            snapshotCo: question.coMapping,
            snapshotRbt: question.rbtLevel,
            snapshotDifficulty: question.difficultyLevel,
            snapshotTeachingIndex: question.teachingIndex,
            changedById: creatorId,
            changeReason: "Initial creation",
          },
        });
      }
    }

    // ---------- MODERATION EVENTS ----------
    const filledSlots = await prisma.questionSlot.findMany({
      where: { questionBankId: bank.id, assignedQuestionId: { not: null } },
      include: { assignedQuestion: true },
    });

    const modId = deptModerators.get(bank.deptCode)!;
    for (const slot of filledSlots) {
      if (!slot.assignedQuestion) continue;
      const q = slot.assignedQuestion;

      if (q.status === QuestionStatus.APPROVED) {
        await prisma.moderationEvent.upsert({
          where: { id: `${bank.id}-mod-${q.id}` },
          update: {},
          create: {
            id: `${bank.id}-mod-${q.id}`,
            questionId: q.id,
            moderatorId: modId,
            action: "APPROVED",
            note: "Question meets quality standards. Approved.",
            createdAt: new Date("2026-09-20"),
          },
        });
      } else if (q.status === QuestionStatus.REJECTED) {
        await prisma.moderationEvent.upsert({
          where: { id: `${bank.id}-mod-${q.id}` },
          update: {},
          create: {
            id: `${bank.id}-mod-${q.id}`,
            questionId: q.id,
            moderatorId: modId,
            action: "REJECTED",
            note: "Question requires revision: unclear wording and missing diagram reference.",
            createdAt: new Date("2026-09-20"),
          },
        });
      } else if (q.status === QuestionStatus.REVISION_REQUESTED) {
        await prisma.moderationEvent.upsert({
          where: { id: `${bank.id}-mod-${q.id}` },
          update: {},
          create: {
            id: `${bank.id}-mod-${q.id}`,
            questionId: q.id,
            moderatorId: modId,
            action: "REVISION_REQUESTED",
            note: "Please provide more examples and clarify the expected answer format.",
            createdAt: new Date("2026-09-18"),
          },
        });
      }
    }
  }

  // ---------- ADVANCE PHASES ACCORDING TO STRATEGY ----------
  for (const bank of allBanks) {
    let targetPhase: QuestionBankPhase = QuestionBankPhase.DRAFTING;
    let shouldLock = false;

    if (bank.strategy === "complete") {
      targetPhase = QuestionBankPhase.COMPLETE;
      shouldLock = true;
    } else if (bank.strategy === "approval") {
      targetPhase = QuestionBankPhase.APPROVAL;
    } else if (bank.strategy === "moderation") {
      targetPhase = QuestionBankPhase.MODERATION;
    } else if (bank.strategy === "full") {
      targetPhase = QuestionBankPhase.MODERATION;
    }
    // "drafting" stays in DRAFTING

    if (targetPhase !== QuestionBankPhase.DRAFTING) {
      await prisma.questionBank.update({
        where: { id: bank.id },
        data: { phase: targetPhase },
      });
    }

    if (shouldLock) {
      // Lock and create snapshot
      await prisma.questionBank.update({
        where: { id: bank.id },
        data: {
          recordStatus: RecordStatus.LOCKED,
          lockedAt: new Date("2026-10-01"),
          lockedReason: "Bank completed and locked after coordinator approval",
        },
      });

      // Create a snapshot
      const snapshotSlots = await prisma.questionSlot.findMany({
        where: { questionBankId: bank.id },
        include: { assignedQuestion: true },
      });

      await prisma.questionBankSnapshot.upsert({
        where: { id: `${bank.id}-snap-locked` },
        update: {},
        create: {
          id: `${bank.id}-snap-locked`,
          questionBankId: bank.id,
          snapshotType: "LOCKED" as any,
          phase: QuestionBankPhase.COMPLETE,
          status: RecordStatus.LOCKED,
          slotAssignments: JSON.stringify(
            snapshotSlots.map((s) => ({
              module: s.moduleNumber,
              marks: s.marks,
              slot: s.slotNumber,
              questionId: s.assignedQuestionId,
            }))
          ),
          version: 1,
          createdAt: new Date("2026-10-01"),
        },
      });
    }

    // ---------- APPROVAL DECISIONS ----------
    if (bank.strategy === "complete") {
      const coordinatorId = deptCoordinators.get(bank.deptCode)!;
      await prisma.approvalDecision.upsert({
        where: { id: `${bank.id}-decision` },
        update: {},
        create: {
          id: `${bank.id}-decision`,
          questionBankId: bank.id,
          decision: CoordinatorDecision.APPROVED,
          remark: "All quality metrics met. Papers generated successfully. Approved.",
          decidedById: coordinatorId,
          decidedAt: new Date("2026-10-05"),
        },
      });
    } else if (bank.strategy === "approval") {
      // Create a mix of approvals and rejections
      const coordinatorId = deptCoordinators.get(bank.deptCode)!;
      const isRejected = bank.semNum === 3; // Sem III banks rejected, sent back
      await prisma.approvalDecision.upsert({
        where: { id: `${bank.id}-decision` },
        update: {},
        create: {
          id: `${bank.id}-decision`,
          questionBankId: bank.id,
          decision: isRejected ? CoordinatorDecision.REJECTED : CoordinatorDecision.APPROVED,
          remark: isRejected ? "Coverage gaps in CO3 and CO4. Some RBT levels underrepresented. Revise and resubmit." : "Adequate coverage. Awaiting paper generation.",
          decidedById: coordinatorId,
          decidedAt: new Date("2026-10-08"),
        },
      });

      if (isRejected) {
        // Loop back to moderation
        await prisma.questionBank.update({
          where: { id: bank.id },
          data: { phase: QuestionBankPhase.MODERATION },
        });
      }
    }
  }

  // ---------- AI REPORTS ----------
  for (const bank of allBanks) {
    if (bank.strategy === "drafting") continue;

    await prisma.aiReport.upsert({
      where: { id: `${bank.id}-aireport` },
      update: {},
      create: {
        id: `${bank.id}-aireport`,
        questionBankId: bank.id,
        status: AiReportStatus.COMPLETED,
        modelName: "Deterministic Analysis Engine",
        summary: generateReportSummary(bank.deptCode, bank.semNum, bank.strategy),
        reportJson: JSON.stringify({
          moduleCoverage: { module1: 85, module2: 78, module3: 92, module4: 65, module5: 71, module6: 80 },
          coDistribution: { CO1: 20, CO2: 18, CO3: 15, CO4: 22, CO5: 14, CO6: 11 },
          difficultyDistribution: { EASY: 28, MEDIUM: 45, HARD: 27 },
          rbtDistribution: { L1: 15, L2: 20, L3: 25, L4: 18, L5: 12, L6: 10 },
          duplicateQuestions: [],
          missingAreas: bank.strategy === "approval" || bank.strategy === "complete" ? [] : ["Module 4 coverage below 70%"],
          qualityFindings: bank.strategy === "complete" ? [] : ["Some questions need CO alignment review"],
          bloomBalance: bank.strategy === "complete" ? "ADEQUATE" : "NEEDS_IMPROVEMENT",
        }),
        generatedAt: new Date("2026-09-25"),
      },
    });

    // For COMPLETE banks, also create a PDF asset reference
    if (bank.strategy === "complete") {
      await prisma.aiReport.update({
        where: { id: `${bank.id}-aireport` },
        data: {
          summary: generateReportSummary(bank.deptCode, bank.semNum, bank.strategy) + " All targets met.",
        },
      });
    }
  }

  // ---------- GENERATED PAPERS (only COMP Sem V) ----------
  const compDeptId = depts.get("COMP")!;
  const compSem5Id = semNumberToId.get(5);
  if (compSem5Id) {
    const compCycle = await prisma.examCycle.findFirst({
      where: { semesterId: compSem5Id, examType: ExamType.ENDSEM, departmentId: compDeptId },
    });
    if (compCycle) {
      const compBanks = await prisma.questionBank.findMany({
        where: { examCycleId: compCycle.id },
        include: {
          subject: true,
          slots: { where: { assignedQuestionId: { not: null } }, include: { assignedQuestion: true } },
        },
      });

      const coeUser = await prisma.user.findFirst({ where: { role: Role.COE } });
      if (coeUser) {
        for (const bank of compBanks) {
          const filledSlots = bank.slots.filter((s) => s.assignedQuestion);
          if (filledSlots.length < 18) continue;

          for (const variant of [PaperVariant.PAPER_A, PaperVariant.PAPER_B, PaperVariant.PAPER_C]) {
            const selectedQuestions = seededShuffle(filledSlots, bank.id.length * 31 + (variant === PaperVariant.PAPER_A ? 1 : variant === PaperVariant.PAPER_B ? 2 : 3)).slice(0, 18);

            const paperJson = {
              title: `${bank.subject.subjectName} - ${variant.replace("_", " ")}`,
              instructions: "Attempt all questions. Each question carries the marks indicated.",
              questions: selectedQuestions.map((s) => ({
                qno: s.slotNumber,
                module: s.moduleNumber,
                marks: s.marks,
                text: s.assignedQuestion!.questionText,
                co: s.assignedQuestion!.coMapping,
                rbt: s.assignedQuestion!.rbtLevel,
              })),
            };

            const paper = await prisma.generatedPaper.upsert({
              where: { questionBankId_variant: { questionBankId: bank.id, variant } },
              update: {},
              create: {
                questionBankId: bank.id,
                variant,
                status: PaperGenerationStatus.COMPLETED,
                generatedById: coeUser.id,
                generatedAt: new Date("2026-10-10"),
                paperJson: JSON.stringify(paperJson),
                coverageScore: 82 + Math.round(Math.random() * 10),
                difficultyScore: 70 + Math.round(Math.random() * 15),
                qualityScore: 75 + Math.round(Math.random() * 15),
                duplicateRisk: Math.random() * 0.1,
                recommendation: "Recommended for use.",
              },
            });

            // Paper items
            for (const s of selectedQuestions) {
              await prisma.generatedPaperItem.upsert({
                where: { generatedPaperId_questionId: { generatedPaperId: paper.id, questionId: s.assignedQuestionId! } },
                update: {},
                create: { generatedPaperId: paper.id, questionId: s.assignedQuestionId! },
              });
            }

            // Paper snapshots
            await prisma.paperSnapshot.upsert({
              where: { questionBankId_variant: { questionBankId: bank.id, variant } },
              update: {},
              create: {
                questionBankId: bank.id,
                variant,
                paperJson: JSON.stringify(paperJson),
                coverageScore: 82 + Math.round(Math.random() * 10),
                difficultyScore: 70 + Math.round(Math.random() * 15),
                qualityScore: 75 + Math.round(Math.random() * 15),
                createdAt: new Date("2026-10-10"),
              },
            });
          }
        }
      }
    }
  }

  // ---------- CSEC approval + Sem V paper ----------
  const csecDeptId = depts.get("CSEC")!;
  const csecSem5Id = semNumberToId.get(5);
  if (csecSem5Id) {
    const csecCycle = await prisma.examCycle.findFirst({
      where: { semesterId: csecSem5Id, examType: ExamType.ENDSEM, departmentId: csecDeptId },
    });
    if (csecCycle) {
      const csecBanks = await prisma.questionBank.findMany({
        where: { examCycleId: csecCycle.id },
        include: { subject: true },
      });
      const coeUser = await prisma.user.findFirst({ where: { role: Role.COE } });
      if (coeUser) {
        for (const bank of csecBanks) {
          for (const variant of [PaperVariant.PAPER_A]) {
            await prisma.generatedPaper.upsert({
              where: { questionBankId_variant: { questionBankId: bank.id, variant } },
              update: {},
              create: {
                questionBankId: bank.id,
                variant,
                status: PaperGenerationStatus.PENDING,
                generatedById: coeUser.id,
              },
            });
          }
        }
      }
    }
  }

  // ---------- AIDS approval + DeanReview ----------
  const aidsDeptId = depts.get("AIDS")!;
  const aidsSem7Id = semNumberToId.get(7);
  if (aidsSem7Id) {
    const aidsCycle = await prisma.examCycle.findFirst({
      where: { semesterId: aidsSem7Id, examType: ExamType.ENDSEM, departmentId: aidsDeptId },
    });
    if (aidsCycle) {
      const aidsBanks = await prisma.questionBank.findMany({
        where: { examCycleId: aidsCycle.id, phase: QuestionBankPhase.COMPLETE },
      });
      for (const bank of aidsBanks) {
        await prisma.deanReview.upsert({
          where: { questionBankId: bank.id },
          update: {},
          create: {
            questionBankId: bank.id,
            regularPaper: PaperVariant.PAPER_A,
            supplementaryPaper: PaperVariant.PAPER_B,
            ktPaper: PaperVariant.PAPER_C,
            reviewedById: dean.id,
            notes: "Coverage is adequate. Paper A ready for use. Papers B and C need minor adjustment in difficulty distribution.",
            status: ReviewStatus.SUBMITTED,
            reviewedAt: new Date("2026-10-20"),
          },
        });
      }
    }
  }

  // ---------- NOTIFICATIONS ----------
  // Notify contributors about their assigned banks
  let notifIdx = 0;
  for (const [deptCode, contribIds] of Array.from(deptContributors)) {
    const deptSubjects = SUBJECTS[deptCode]?.filter((s) => TARGET_SEMESTERS.includes(s.semNumber)) ?? [];
    for (const subj of deptSubjects) {
      for (const contribId of contribIds) {
        await prisma.notification.upsert({
          where: { id: `seed-notif-${deptCode}-${subj.code}-${contribId}` },
          update: {},
          create: {
            id: `seed-notif-${deptCode}-${subj.code}-${contribId}`,
            recipientId: contribId,
            title: "Question contribution assigned",
            message: `You have been assigned as contributor for ${subj.name} (${subj.code}). Please draft and submit questions.`,
            type: NotificationType.ACTION_REQUIRED,
            actionUrl: "/dashboard/contributor",
            createdAt: new Date(Date.now() - 86400000 * (30 - notifIdx)),
          },
        });
        notifIdx++;
        if (notifIdx > 50) break;
      }
    }
  }

  // Notification for coordinator about pending approvals
  for (const [deptCode, coordId] of Array.from(deptCoordinators)) {
    const strategy = BANK_STRATEGIES[deptCode] ?? "full";
    if (strategy === "approval") {
      await prisma.notification.upsert({
        where: { id: `seed-notif-approval-${deptCode}` },
        update: {},
        create: {
          id: `seed-notif-approval-${deptCode}`,
          recipientId: coordId,
          title: "Banks ready for approval review",
          message: `Question banks in ${deptCode} have completed moderation and are awaiting your approval decision.`,
          type: NotificationType.ACTION_REQUIRED,
          actionUrl: "/dashboard/coordinator/approval",
          createdAt: new Date("2026-10-01"),
        },
      });
    }
    if (strategy === "moderation") {
      await prisma.notification.upsert({
        where: { id: `seed-notif-mod-${deptCode}` },
        update: {},
        create: {
          id: `seed-notif-mod-${deptCode}`,
          recipientId: coordId,
          title: "Moderation in progress",
          message: `Banks in ${deptCode} are under moderation. Some questions need revision.`,
          type: NotificationType.WARNING,
          actionUrl: "/dashboard/coordinator/moderation",
          createdAt: new Date("2026-09-15"),
        },
      });
    }
  }

  // ---------- SUMMARY ----------
  const deptCount = await prisma.department.count();
  const userCount = await prisma.user.count();
  const subjectCount = await prisma.subject.count();
  const cycleCount = await prisma.examCycle.count();
  const bankCount = await prisma.questionBank.count();
  const slotCount = await prisma.questionSlot.count();
  const questionCount = await prisma.questionLibraryItem.count();
  const modEventCount = await prisma.moderationEvent.count();
  const aiReportCount = await prisma.aiReport.count();
  const paperCount = await prisma.generatedPaper.count();

  console.log("\n═══════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`  Departments:        ${deptCount}`);
  console.log(`  Users:              ${userCount}`);
  console.log(`  Academic Years:     ${ACADEMIC_YEARS.length}`);
  console.log(`  Semesters:          ${await prisma.semester.count()}`);
  console.log(`  Subjects:           ${subjectCount}`);
  console.log(`  Exam Cycles:        ${cycleCount}`);
  console.log(`  Question Banks:     ${bankCount}`);
  console.log(`  Question Slots:     ${slotCount}`);
  console.log(`  Questions:          ${questionCount}`);
  console.log(`  Moderation Events:  ${modEventCount}`);
  console.log(`  AI Reports:         ${aiReportCount}`);
  console.log(`  Generated Papers:   ${paperCount}`);
  console.log("─────────────────────────────────────");
  console.log("  All passwords: Password@123");
  console.log("  COE:    coe@emqpgs.local");
  console.log("  Dean:   dean@emqpgs.local");
  for (const code of Object.keys(STAFF_NAMES)) {
    console.log(`  ${code} Coordinator:  coordinator.${code.toLowerCase()}@emqpgs.local`);
    console.log(`  ${code} Moderator:    moderator.${code.toLowerCase()}@emqpgs.local`);
    for (let i = 1; i <= 3; i++) {
      console.log(`  ${code} Contributor: contributor${i}.${code.toLowerCase()}@emqpgs.local`);
    }
  }
  console.log("═══════════════════════════════════════\n");
}

function generateReportSummary(deptCode: string, semNum: number, strategy: string): string {
  if (strategy === "complete") return `${deptCode} Sem ${semNum}: Bank has full coverage across all 6 modules with balanced CO and RBT distribution.`;
  if (strategy === "approval") return `${deptCode} Sem ${semNum}: Good overall coverage. Module 4 slightly under-represented. RBT levels L4-L6 need attention.`;
  if (strategy === "moderation") return `${deptCode} Sem ${semNum}: 70% slot fill rate. Significant gaps in Modules 5-6. Several questions pending moderation review.`;
  if (strategy === "drafting") return `${deptCode} Sem ${semNum}: Early stage. Only basic coverage established. Multiple modules need question contributions.`;
  return `${deptCode} Sem ${semNum}: Moderate coverage. 60% slots filled. CO distribution is reasonable but RBT skew toward L1-L3.`;
}

main().then(async () => { await prisma.$disconnect(); }).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
