import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { RawBankData, ExtractedQuestionData, ModuleSummary } from "./types";
import { EXTRACTION_ATTRIBUTES, attributeStatus } from "./metric-engine";

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
                id: true,
                questionText: true,
                marks: true,
                moduleNumber: true,
                coMapping: true,
                rbtLevel: true,
                difficultyLevel: true,
                status: true,
                questionType: true,
                poMapping: true,
                piMapping: true,
              },
            },
          },
        },
      },
    });

    if (!bank) throw new NotFoundError("QuestionBank not found");

    const questions: ExtractedQuestionData[] = bank.slots
      .filter((s) => s.assignedQuestion)
      .sort((a, b) => a.moduleNumber - b.moduleNumber || a.marks - b.marks || a.slotNumber - b.slotNumber || a.id.localeCompare(b.id))
      .map((slot, idx) => {
        const q = slot.assignedQuestion!;
        const verb = extractCommandVerb(q.questionText);
        const poMappings = mappingIds(q.poMapping);
        const piMappings = mappingIds(q.piMapping);
        return {
          questionIndex: idx + 1,
          sourceQuestionId: q.id ?? slot.assignedQuestionId,
          sourceSlotId: slot.id,
          sourceSlotNumber: slot.slotNumber,
          poMapping: poMappings?.join(", ") || null,
          piMapping: piMappings?.join(", ") || null,
          poMappings,
          piMappings,
          poStatus: poMappings?.length ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          piStatus: piMappings?.length ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          questionTypeStatus: q.questionType ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          attributeStatuses: {
            questionId: (q.id ?? slot.assignedQuestionId) ? "VERIFIED" : "MISSING_DATA",
            questionText: q.questionText.trim() ? "VERIFIED" : "MISSING_DATA",
            marks: Number.isFinite(q.marks) && q.marks > 0 ? "VERIFIED" : "MISSING_DATA",
          },
          questionText: q.questionText,
          marks: q.marks,
          moduleNumber: slot.moduleNumber,
          coMapping: q.coMapping as unknown as string | null,
          rbtLevel: q.rbtLevel as unknown as string | null,
          difficultyLevel: q.difficultyLevel as unknown as string | null,
          questionType: q.questionType ?? null,
          commandVerb: verb,
          coStatus: q.coMapping ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          rbtStatus: q.rbtLevel ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          difficultyStatus: q.difficultyLevel ? "UNABLE_TO_VERIFY" : "MISSING_DATA",
          questionStatus: (q.status as string) ?? null,
          clarityScore: 0,
        };
      });

    for (const q of questions) {
      q.attributeStatuses = Object.fromEntries(EXTRACTION_ATTRIBUTES.map(a => [a, attributeStatus(q, a)]));
    }
    const modules = buildModuleSummaries(questions);
    const all = (check: (q: ExtractedQuestionData) => boolean) => questions.length > 0 ? questions.every(check) : null;
    const filled = bank.slots.filter(s => s.assignedQuestion);
    const numbering = filled.map(s => `${s.moduleNumber}:${s.marks}:${s.slotNumber}`);
    const structuralChecks: RawBankData["structuralChecks"] = {
      courseInformation: !!(bank.subject.subjectName.trim() && bank.subject.subjectCode.trim()),
      questionNumbering: filled.length ? filled.every(s => Number.isInteger(s.slotNumber) && s.slotNumber > 0) && new Set(numbering).size === filled.length : null,
      marksAllocation: all(q => Number.isFinite(q.marks) && q.marks > 0),
      coMapping: all(q => !!q.coMapping?.trim()),
      bloomMapping: all(q => !!q.rbtLevel?.trim()),
      difficultyMapping: all(q => !!q.difficultyLevel?.trim()),
      // The database has module identifiers, not authored section labels/instructions.
      sectionLabels: null,
      assessmentInstructions: null,
      metadataConsistency: filled.length ? filled.every(s => s.assignedQuestion!.marks === s.marks && s.assignedQuestion!.moduleNumber === s.moduleNumber) : null,
      questionFormatting: all(q => q.questionText.trim().length > 0 && !q.questionText.includes("�")),
    };

    return {
      questionBankId: bank.id,
      structuralChecks,
      subjectName: bank.subject.subjectName,
      subjectCode: bank.subject.subjectCode,
      totalSlots: bank.pattern?.totalSlots ?? bank.slots.length,
      filledSlots: questions.length,
      questions,
      modules,
      totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
      marksOptions: (bank.pattern?.marksPattern as number[]) ?? [],
      extractionTimestamp: new Date().toISOString(),
    };
  }
}

function mappingIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(item => typeof item === "string" && item.trim().length > 0)) return null;
  return [...new Set(value.map(item => item.trim()))];
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
