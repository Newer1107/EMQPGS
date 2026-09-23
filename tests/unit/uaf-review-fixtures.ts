import type { RawBankData } from "@/lib/uaf/types";
import type { AuthContext } from "@/lib/types";
import { buildReviewSource } from "@/modules/uaf-review/source";
import { AMI_CRITERIA, ATTRIBUTES, CAI_CRITERIA, FRI_CRITERIA, QCQI_CRITERIA } from "@/modules/uaf-review/criteria";
import type { ReviewEvidence } from "@/modules/uaf-review/validation";

export const evidenceSource = { sourceType: "SYLLABUS" as const, reference: "Approved course file §3", rationale: "Reviewed against the approved outcome and assessment rubric." };
export function bankFixture(updatedAt = "2026-09-01T00:00:00.000Z") {
  return { id: "bank", version: 1, subject: { subjectCode: "M1", subjectName: "Math", departmentId: "dept" },
    pattern: { totalSlots: 1 }, auditBlueprints: [], slots: [{ id: "slot", moduleNumber: 1, marks: 5, slotNumber: 1, assignedQuestionId: "q1",
      assignedQuestion: { id: "q1", questionText: "Explain the theorem.", marks: 5, moduleNumber: 1, coMapping: "CO1", poMapping: ["PO1"], piMapping: ["PI1"], rbtLevel: "L2", difficultyLevel: "MEDIUM", questionType: "THEORY", subjectVersionId: "sv1", updatedAt: new Date(updatedAt), status: "APPROVED" },
    }],
  };
}
export function sourceFixture(updatedAt?: string) { return buildReviewSource(bankFixture(updatedAt) as never); }
export function reviewFixture(): ReviewEvidence {
  const source = sourceFixture();
  return { schemaVersion: 1, bankFingerprint: source.bankFingerprint,
    questions: [{ questionId: "q1", questionVersion: source.questions[0].questionVersion,
      attributes: ATTRIBUTES.map(attribute => ({ attribute, accurate: false, evidence: evidenceSource })),
      qcqi: QCQI_CRITERIA.map(criterion => ({ criterion, score: 0.5, evidence: evidenceSource })),
      cai: CAI_CRITERIA.map(criterion => ({ criterion, satisfied: true, evidence: evidenceSource })),
      metadataConsistency: { score: 0, evidence: evidenceSource },
    }],
    bankCriteria: { AMI: AMI_CRITERIA.map(criterion => ({ criterion, score: 0, evidence: evidenceSource })), FRI: FRI_CRITERIA.map(criterion => ({ criterion, score: 1, evidence: evidenceSource })) },
  };
}
export function rawFixture(): RawBankData {
  const source = sourceFixture();
  return { questionBankId: "bank", subjectName: "Math", subjectCode: "M1", totalSlots: 1, filledSlots: 1, totalMarks: 5, marksOptions: [5], modules: [], extractionTimestamp: "2026-09-23T00:00:00Z",
    questions: [{ questionIndex: 1, sourceQuestionId: "q1", sourceSlotId: "slot", sourceSlotNumber: 1,
      questionText: source.questions[0].questionText, marks: 5, moduleNumber: 1, coMapping: "CO1", rbtLevel: "L2", difficultyLevel: "MEDIUM", questionType: "THEORY", commandVerb: "explain", poMapping: "PO1", piMapping: "PI1", poMappings: ["PO1"], piMappings: ["PI1"],
      coStatus: "UNABLE_TO_VERIFY", rbtStatus: "UNABLE_TO_VERIFY", difficultyStatus: "UNABLE_TO_VERIFY", questionStatus: "APPROVED", clarityScore: 0,
    }],
  };
}
export function authFixture(): AuthContext {
  return { user: { id: "reviewer", name: "Coordinator", email: "coordinator@example.test" }, responsibilities: [{ id: "assignment", type: "COORDINATOR", scopeType: "DEPARTMENT", scopeId: "dept", activeFrom: new Date("2020-01-01"), activeTo: null }] };
}
