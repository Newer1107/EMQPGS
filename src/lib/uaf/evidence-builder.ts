import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { RawBankData, ExtractedQuestionData, ModuleSummary } from "./types";

export class EvidenceBuilder {
  async collect(questionBankId: string): Promise<RawBankData> {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: { select: { subjectName: true, subjectCode: true } },
        slots: {
          include: {
            assignedQuestion: {
              select: {
                questionText: true,
                marks: true,
                coMapping: true,
                rbtLevel: true,
                difficultyLevel: true,
                moduleNumber: true,
              },
            },
          },
        },
      },
    });

    if (!bank) throw new NotFoundError("QuestionBank not found");

    const questions: ExtractedQuestionData[] = bank.slots
      .filter((s) => s.assignedQuestion)
      .map((slot, idx) => ({
        questionIndex: idx + 1,
        questionText: slot.assignedQuestion!.questionText,
        marks: slot.assignedQuestion!.marks,
        moduleNumber: slot.assignedQuestion!.moduleNumber,
        coMapping: slot.assignedQuestion!.coMapping as unknown as string | null,
        rbtLevel: slot.assignedQuestion!.rbtLevel as unknown as string | null,
        difficultyLevel: slot.assignedQuestion!.difficultyLevel as unknown as string | null,
        questionType: null,
        commandVerb: extractCommandVerb(slot.assignedQuestion!.questionText),
        coStatus: slot.assignedQuestion!.coMapping ? "VERIFIED" : "MISSING_DATA",
        rbtStatus: slot.assignedQuestion!.rbtLevel ? "VERIFIED" : "MISSING_DATA",
        difficultyStatus: slot.assignedQuestion!.difficultyLevel ? "VERIFIED" : "MISSING_DATA",
      }));

    const modules = buildModuleSummaries(questions);

    return {
      questionBankId: bank.id,
      subjectName: bank.subject.subjectName,
      subjectCode: bank.subject.subjectCode,
      totalSlots: bank.slots.length,
      filledSlots: questions.length,
      questions,
      modules,
      totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
      extractionTimestamp: new Date().toISOString(),
    };
  }
}

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
