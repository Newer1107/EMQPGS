import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: { questionBank:{findUnique:vi.fn()},uafReview:{findFirst:vi.fn()},$transaction:vi.fn() } }));
import { prisma } from "@/lib/db";
import { EvidenceBuilder } from "@/lib/uaf/evidence-builder";
import { MetricEngine } from "@/lib/uaf/metric-engine";
import { SnapshotBuilder } from "@/lib/uaf/snapshot-builder";
import { buildReviewSource } from "@/modules/uaf-review/source";
import { ATTRIBUTES, QCQI_CRITERIA, CAI_CRITERIA, AMI_CRITERIA, FRI_CRITERIA } from "@/modules/uaf-review/criteria";

function fixture() {
  return {
    id:"bank1",version:1,
    subject:{subjectName:"Algorithms",subjectCode:"CS1",departmentId:"d1"},
    pattern:{totalSlots:2,totalModules:1,marksPattern:[5]},
    auditBlueprints:[{id:"bp1",version:1,data:{
      schemaVersion:1,syllabusReference:"Syllabus",
      table1:[{module:1,name:"Algorithms",hours:10,co:["CO1","CO2"]}],
      table2:[{module:1,theory:100,numerical:0}],table3:{theory:100,numerical:0},
    }}],
    slots:[1,2].map(n=>({
      id:"s"+n,moduleNumber:1,marks:5,slotNumber:n,assignedQuestionId:"q"+n,
      assignedQuestion:{id:"q"+n,questionText:"Explain algorithm "+n+".",moduleNumber:1,marks:5,
        coMapping:"CO1",poMapping:["PO1"],piMapping:["PI1"],rbtLevel:"L2",difficultyLevel:"MEDIUM",
        questionType:"THEORY",status:"APPROVED",subjectVersionId:"sv1",updatedAt:new Date("2026-09-23T00:00:00Z")},
    })),
  };
}
function savedReview(bank:ReturnType<typeof fixture>) {
  const source=buildReviewSource(bank as unknown as Parameters<typeof buildReviewSource>[0]);
  const evidence={sourceType:"RUBRIC" as const,reference:"Rubric 4.2",rationale:"Reviewed against explicit documented assessment requirements."};
  return {id:"review1",version:1,reviewerId:"staff1",evidence:{
    schemaVersion:1,bankFingerprint:source.bankFingerprint,
    questions:source.questions.map(q=>({
      questionId:q.id,questionVersion:q.questionVersion,
      attributes:ATTRIBUTES.map(attribute=>({attribute,accurate:attribute!=="coMapping",evidence})),
      qcqi:QCQI_CRITERIA.map(criterion=>({criterion,score:.2,evidence})),
      cai:CAI_CRITERIA.map(criterion=>({criterion,satisfied:false,evidence})),
    })),
    bankCriteria:{AMI:AMI_CRITERIA.map(criterion=>({criterion,score:0,evidence})),FRI:FRI_CRITERIA.map(criterion=>({criterion,score:0,evidence}))},
  }};
}
async function collect(bank:ReturnType<typeof fixture>, review:ReturnType<typeof savedReview>|null) {
  vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(bank as never);
  vi.mocked(prisma.uafReview.findFirst).mockResolvedValue(review as never);
  const raw=await new EvidenceBuilder().collect(bank.id);
  const metrics=new MetricEngine().computeAll(raw);
  return {raw,metrics,snapshot:new SnapshotBuilder().build(raw,metrics),metric:(code:string)=>metrics.find(m=>m.indexCode===code)!};
}
describe("collector → actual review adapter → metrics → snapshot",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (tx: typeof prisma)=>unknown)=>callback(prisma)) as never);
  });
  it("keeps declared observations and uses complete review coverage independently of low quality",async()=>{
    const bank=fixture();
    const {raw,metric,snapshot}=await collect(bank,savedReview(bank));
    expect(raw.documentedCourseOutcomes).toEqual(["CO1","CO2"]);
    expect(raw.questions[0].coMapping).toBe("CO1");
    expect(raw.questions[0].coStatus).toBe("VERIFIED");
    expect(raw.questions[0].attributeStatuses?.coMapping).toBe("VERIFIED");
    expect(raw.questions[0].attributeAccuracy?.coMapping).toBe(false);
    expect(metric("COA").value).toBe(0);
    expect(metric("QCQI").value).toBeCloseTo(.2);
    expect(metric("QCQI").confidenceScore).toBe(1);
    expect(metric("CAI").value).toBe(0);
    expect(metric("CAI").confidenceScore).toBe(1);
    expect(metric("AMI").value).toBe(0);
    expect(metric("FRI").value).toBe(0);
    expect(metric("SCI").confidenceScore).toBe(.8);
    expect(metric("BDI").confidenceScore).toBe(1);
    expect(metric("MCAI").confidenceScore).toBe(1);
    expect(metric("MII").confidenceScore).toBeCloseTo(8/9);
    expect(metric("OCI").value).toBeGreaterThan(.9);
    expect(metric("QPQI").value).toBeNull();
    expect(snapshot.questions?.[0].qualityEvidence?.clarity?.sourceIds[0]).toContain("uaf-review:review1");
    expect(snapshot.reviewProvenance?.reviewId).toBe("review1");
    expect(snapshot.indexConfidence?.QCQI).toEqual({verified:14,required:14});
    expect(snapshot.indexConfidence?.MII).toEqual({verified:16,required:18});
  });
  it("leaves incomplete QCQI and CAI null with proportional evidence confidence",async()=>{
    const bank=fixture(),review=savedReview(bank);
    review.evidence.questions[1].qcqi.pop();
    review.evidence.questions[1].cai.pop();
    const {metric}=await collect(bank,review);
    expect(metric("QCQI").value).toBeNull();
    expect(metric("QCQI").confidenceScore).toBe(13/14);
    expect(metric("CAI").value).toBeNull();
    expect(metric("CAI").confidenceScore).toBe(7/8);
  });
  it("invalidates changed-question reviews and bank moderation while preserving declared values",async()=>{
    const bank=fixture(),review=savedReview(bank);
    bank.slots[0].assignedQuestion.questionText="Changed after review.";
    bank.slots[0].assignedQuestion.updatedAt=new Date("2026-09-24T00:00:00Z");
    const {raw,metric}=await collect(bank,review);
    expect(raw.questions[0].questionText).toBe("Changed after review.");
    expect(raw.questions[0].coStatus).toBe("UNABLE_TO_VERIFY");
    expect(raw.questions[0].attributeStatuses?.coMapping).toBe("UNABLE_TO_VERIFY");
    expect(raw.questions[0].attributeAccuracy?.coMapping).toBeUndefined();
    expect(metric("QCQI").value).toBeNull();
    expect(metric("QCQI").confidenceScore).toBe(.5);
    expect(metric("CAI").value).toBeNull();
    expect(metric("AMI").value).toBeNull();
    expect(metric("AMI").confidenceScore).toBe(0);
    expect(raw.reviewProvenance?.staleQuestionIds).toEqual(["q1"]);
  });
  it("never turns absent source metadata into verified attributes",async()=>{
    const bank=fixture(),review=savedReview(bank);
    bank.slots[0].assignedQuestion.piMapping=[];
    // Construct a current review containing an invalid claim; adapter still checks source.
    const current=savedReview(bank);
    current.evidence.questions[0].attributes=review.evidence.questions[0].attributes;
    const {raw,metric}=await collect(bank,current);
    expect(raw.questions[0].piStatus).toBe("MISSING_DATA");
    expect(raw.questions[0].attributeStatuses?.piMapping).toBe("MISSING_DATA");
    expect(raw.questions[0].attributeAccuracy?.piMapping).toBeUndefined();
    expect(metric("PIA").value).toBeNull();
  });
  it("keeps rerun hashes stable and invalidates them when review version changes",async()=>{
    const bank=fixture(),review=savedReview(bank),builder=new SnapshotBuilder();
    const first=await collect(bank,review);
    const second=await collect(bank,review);
    expect(builder.computeEvidenceHash(first.snapshot,"v1","p1")).toBe(builder.computeEvidenceHash(second.snapshot,"v1","p1"));
    review.version=2;
    const revised=await collect(bank,review);
    expect(builder.computeEvidenceHash(first.snapshot,"v1","p1")).not.toBe(builder.computeEvidenceHash(revised.snapshot,"v1","p1"));
  });
  it("keeps unreviewed academic attributes unable to verify",async()=>{
    const {raw,metric}=await collect(fixture(),null);
    expect(raw.questions[0].coStatus).toBe("UNABLE_TO_VERIFY");
    expect(raw.questions[0].attributeStatuses?.coMapping).toBe("UNABLE_TO_VERIFY");
    expect(metric("QCQI").value).toBeNull();
    expect(metric("CAI").value).toBeNull();
  });
});
