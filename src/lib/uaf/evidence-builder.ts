import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { RawBankData, ExtractedQuestionData, ModuleSummary } from "./types";

export class EvidenceBuilder {
  async collect(questionBankId: string): Promise<RawBankData> {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: { select: { subjectName: true, subjectCode: true } },
        pattern: { select: { totalModules: true, marksPattern: true, totalSlots: true } },
        slots: {
          include: {
            assignedQuestion: {
              select: {
                questionText: true,
                marks: true,
                moduleNumber: true,
                coMapping: true,
                rbtLevel: true,
                difficultyLevel: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!bank) throw new NotFoundError("QuestionBank not found");

    const questions: ExtractedQuestionData[] = bank.slots
      .filter((s) => s.assignedQuestion)
      .map((slot, idx) => {
        const q = slot.assignedQuestion!;
        const verb = extractCommandVerb(q.questionText);
        return {
          questionIndex: idx + 1,
          questionText: q.questionText,
          marks: q.marks,
          moduleNumber: slot.moduleNumber,
          coMapping: q.coMapping as unknown as string | null,
          rbtLevel: q.rbtLevel as unknown as string | null,
          difficultyLevel: q.difficultyLevel as unknown as string | null,
          questionType: classifyQuestionType(q.questionText, verb, q.marks),
          commandVerb: verb,
          coStatus: q.coMapping ? "VERIFIED" : "MISSING_DATA",
          rbtStatus: q.rbtLevel ? "VERIFIED" : "MISSING_DATA",
          difficultyStatus: q.difficultyLevel ? "VERIFIED" : "MISSING_DATA",
          questionStatus: (q.status as string) ?? null,
          clarityScore: computeClarityScore(q.questionText, q.coMapping, q.rbtLevel, q.difficultyLevel),
        };
      });

    const modules = buildModuleSummaries(questions);

    return {
      questionBankId: bank.id,
      subjectName: bank.subject.subjectName,
      subjectCode: bank.subject.subjectCode,
      totalSlots: bank.pattern?.totalSlots ?? bank.slots.length,
      filledSlots: questions.length,
      questions,
      modules,
      totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
      marksOptions: (bank.pattern?.marksPattern as number[]) ?? [2, 5, 10],
      extractionTimestamp: new Date().toISOString(),
    };
  }
}

// ── Question Type Classification ─────────────────────────────────

const QUESTION_TYPE_MAP: Record<string, string> = {
  define: "definition", list: "enumeration", recall: "recall", state: "enumeration",
  identify: "identification", label: "identification",
  explain: "explanation", describe: "description", discuss: "discussion",
  summarize: "summary", interpret: "interpretation",
  use: "application", implement: "application", solve: "problem-solving",
  execute: "application", demonstrate: "demonstration",
  compare: "comparison", differentiate: "differentiation", investigate: "investigation",
  categorize: "categorization",
  assess: "evaluation", critique: "evaluation", justify: "justification",
  recommend: "recommendation", validate: "validation",
  design: "design", develop: "development", construct: "construction",
  propose: "proposal", formulate: "formulation",
};

function classifyQuestionType(text: string, verb: string | null, marks: number): string {
  if (verb && QUESTION_TYPE_MAP[verb]) return QUESTION_TYPE_MAP[verb];
  // Heuristic: long questions with high marks are likely "essay" or "problem-solving"
  const wordCount = text.split(/\s+/).length;
  if (marks >= 10 && wordCount > 50) return "essay";
  if (marks >= 5 && wordCount > 30) return "analytical";
  if (marks <= 2) return "short-answer";
  return "constructed-response";
}

// ── Clarity Score ────────────────────────────────────────────────

function computeClarityScore(
  text: string,
  coMapping: string | null,
  rbtLevel: string | null,
  difficultyLevel: string | null,
): number {
  let score = 0;
  // Text quality: starts with capital letter, ends with punctuation
  const trimmed = text.trim();
  if (/^[A-Z]/.test(trimmed)) score += 0.2;
  if (/[.?!]$/.test(trimmed)) score += 0.1;
  // Reasonable length
  const wc = trimmed.split(/\s+/).length;
  if (wc >= 5 && wc <= 100) score += 0.2;
  // Has question mark or instruction verb
  if (trimmed.includes("?")) score += 0.15;
  // Metadata presence
  if (coMapping) score += 0.15;
  if (rbtLevel) score += 0.1;
  if (difficultyLevel) score += 0.1;
  return Math.min(score, 1);
}

// ── Command Verb Extraction ──────────────────────────────────────

function extractCommandVerb(text: string): string | null {
  const verbs = [
    "define", "list", "recall", "state", "identify", "label",
    "explain", "describe", "discuss", "summarize", "interpret",
    "use", "implement", "solve", "execute", "demonstrate",
    "compare", "differentiate", "investigate", "categorize",
    "assess", "critique", "justify", "recommend", "validate",
    "design", "develop", "construct", "propose", "formulate",
  ];
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
  if (firstWord && verbs.includes(firstWord)) return firstWord;
  return null;
}

// ── Module Summary Builder ───────────────────────────────────────

function buildModuleSummaries(questions: ExtractedQuestionData[]): ModuleSummary[] {
  const map = new Map<number, { count: number; marks: number; cos: Set<string> }>();
  for (const q of questions) {
    const m = map.get(q.moduleNumber) ?? { count: 0, marks: 0, cos: new Set<string>() };
    m.count++;
    m.marks += q.marks;
    if (q.coMapping) m.cos.add(q.coMapping);
    map.set(q.moduleNumber, m);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([moduleNumber, data]) => ({
      moduleNumber,
      totalQuestions: data.count,
      totalMarks: data.marks,
      coveredCOs: Array.from(data.cos).sort(),
    }));
}
