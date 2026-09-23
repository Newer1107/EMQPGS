import { describe, it, expect } from "vitest";
import {
  classifyIndex,
  classifyConfidence,
  computeConfidence,
} from "@/lib/uaf/classification-matrix";
import {
  computeECS,
  computeEQI,
  computeCOA,
  computePOA,
  computePIA,
  computeRBTA,
  computeDA,
  computeMAA,
  computeQTA,
  computeMC,
  computeMCS,
  computeLOTS,
  computeHOTS,
  computeCBR,
  computeSCI,
  computeMII,
  computeBDI,
  computeCVI,
  computeMCAI,
  computeDBI,
  computeQCQI,
  computeCAI,
  computeAMI,
  computeFRI,
  computeQPQI,
  computeOCI,
  MetricEngine,
} from "@/lib/uaf/metric-engine";
import type { RawBankData, ExtractedQuestionData } from "@/lib/uaf/types";
import type { MetricResult } from "@/lib/uaf/metric-engine";

// ── Helpers ──

function baseQuestion(overrides: Partial<ExtractedQuestionData> = {}): ExtractedQuestionData {
  return {
    questionIndex: 1,
    questionText: "Sample question?",
    marks: 5,
    moduleNumber: 1,
    coMapping: "CO1",
    rbtLevel: "L2",
    difficultyLevel: "MEDIUM",
    questionType: null,
    commandVerb: null,
    coStatus: "VERIFIED",
    rbtStatus: "VERIFIED",
    difficultyStatus: "VERIFIED",
    questionStatus: null,
    clarityScore: 0,
    ...overrides,
  };
}

function makeData(questions: ExtractedQuestionData[], overrides: Partial<RawBankData> = {}): RawBankData {
  return {
    questionBankId: "qb-test",
    subjectName: "Test Subject",
    subjectCode: "TS101",
    totalSlots: questions.length,
    filledSlots: questions.length,
    questions,
    modules: [],
    totalMarks: questions.reduce((s, q) => s + q.marks, 0),
    extractionTimestamp: "2026-06-22T00:00:00Z",
    marksOptions: [2, 5, 10],
    ...overrides,
  };
}


describe("UAF evidence contracts", () => {
  it("counts all nine required attributes without status/command verb inflation", () => {
    const q = baseQuestion({ sourceQuestionId: "q1", poMapping: "PO1", piMapping: "PI1", questionType: "Theory" });
    expect(computeECS(makeData([q])).value).toBe(1);
    expect(computeECS(makeData([baseQuestion()])).value).toBeCloseTo(5 / 9);
    expect(computeECS(makeData([baseQuestion({questionText: " ", marks: 0, coMapping:null, rbtLevel:null, difficultyLevel:null})])).value).toBe(0);
    expect(computeECS(makeData([])).value).toBeNull();
  });
  it("EQI counts individually verified extracted attributes", () => {
    const data = makeData([baseQuestion(), baseQuestion({coStatus:"UNABLE_TO_VERIFY"})]);
    expect(computeEQI(data).value).toBe(5 / 10);
    expect(computeEQI(makeData([baseQuestion({marks:NaN,questionText:"",coMapping:null,rbtLevel:null,difficultyLevel:null})])).value).toBeNull();
  });
  it("does not fabricate PO/PI, type or accuracy from field presence", () => {
    const data = makeData([baseQuestion({coStatus:"UNABLE_TO_VERIFY"})]);
    for (const fn of [computeCOA,computePOA,computePIA,computeQTA,computeMAA]) expect(fn(data).value).toBeNull();
    expect(computePOA(makeData([baseQuestion({poMapping:"PO1",poStatus:"VERIFIED"})])).value).toBe(1);
    expect(computePIA(makeData([baseQuestion({piMapping:"PI1",piStatus:"VERIFIED"})])).value).toBe(1);
    expect(computeRBTA(makeData([baseQuestion({rbtLevel:null})])).value).toBeNull();
    expect(computeDA(makeData([baseQuestion({difficultyStatus:"UNABLE_TO_VERIFY"})])).value).toBeNull();
  });
  it("supports reviewed incorrect attributes without treating missing evidence as incorrect", () => {
    expect(computeCOA(makeData([baseQuestion({attributeAccuracy:{coMapping:false}}),baseQuestion()])).value).toBe(.5);
    expect(computeMAA(makeData([baseQuestion({attributeAccuracy:{marks:false}})])).value).toBe(0);
    expect(computeQTA(makeData([baseQuestion({questionType:"Theory",questionTypeStatus:"VERIFIED"})])).value).toBe(1);
  });
  it("metadata completeness includes PO, PI, marks and type", () => {
    expect(computeMC(makeData([baseQuestion()])).value).toBe(4/7);
    expect(computeMCS(makeData([baseQuestion()])).value).toBeNull();
  });
  it("SCI requires the ten structural checks, independent of filled slots", () => {
    const structuralChecks: NonNullable<RawBankData["structuralChecks"]> = {
      courseInformation:true,questionNumbering:true,marksAllocation:true,coMapping:true,
      bloomMapping:true,difficultyMapping:true,sectionLabels:false,assessmentInstructions:false,
      metadataConsistency:true,questionFormatting:true,
    };
    expect(computeSCI(makeData([baseQuestion()])).value).toBeNull();
    expect(computeSCI(makeData([baseQuestion()], {filledSlots:1,totalSlots:100,structuralChecks})).value).toBe(.8);
    expect(computeSCI(makeData([baseQuestion()], {structuralChecks:{...structuralChecks,assessmentInstructions:null}})).value).toBeNull();
  });
  it("CVI uses only documented outcome identifiers and deduplicates them", () => {
    const data = makeData([baseQuestion(),baseQuestion({coMapping:"CO99"})], {documentedCourseOutcomes:["CO1","CO2","CO2"]});
    expect(computeCVI(data).value).toBe(.5);
    expect(computeCVI(makeData([baseQuestion()])).value).toBeNull();
    expect(computeCVI(makeData([baseQuestion()],{documentedCourseOutcomes:[]})).value).toBeNull();
  });
  it("Bloom and difficulty balance require complete observed data", () => {
    for (const fn of [computeBDI,computeDBI,computeLOTS,computeHOTS,computeMCAI]) expect(fn(makeData([])).value).toBeNull();
    expect(computeBDI(makeData([baseQuestion({rbtLevel:null})])).value).toBeNull();
    expect(computeBDI(makeData([baseQuestion({rbtLevel:"bogus"})])).value).toBeNull();
    expect(computeDBI(makeData([baseQuestion({difficultyLevel:null})])).value).toBeNull();
    expect(computeBDI(makeData([baseQuestion({rbtLevel:"L3"})])).value).toBeCloseTo(.25);
    expect(computeDBI(makeData([baseQuestion()])).value).toBeCloseTo(.5);
    const uniform = Object.fromEntries(["L1","L2","L3","L4","L5","L6"].map(k=>[k,1/6]));
    const data = makeData(["L1","L2","L3","L4","L5","L6"].map(rbtLevel=>baseQuestion({rbtLevel})),{expectedBloomDistribution:uniform});
    expect(computeBDI(data).value).toBe(1);
    expect(computeBDI({...data,expectedBloomDistribution:{L1:1}}).value).toBeNull();
  });
  it("computes cognitive ratios and the documented marks matrix", () => {
    const data = makeData([baseQuestion({rbtLevel:"L1",marks:2}),baseQuestion({rbtLevel:"L6",marks:15})]);
    expect(computeLOTS(data).value).toBe(.5);
    expect(computeHOTS(data).value).toBe(.5);
    expect(computeCBR(data,computeLOTS(data),computeHOTS(data)).value).toBe(1);
    expect(computeMCAI(data).value).toBe(1);
    expect(computeMCAI(makeData([baseQuestion({rbtLevel:"L1",marks:15})])).value).toBe(0);
    expect(computeMCAI(makeData([baseQuestion({marks:-1})])).value).toBeNull();
  });
  it("preserves a CBR above one alongside its normalized index", () => {
    const data=makeData([baseQuestion({rbtLevel:"L1"}),baseQuestion({rbtLevel:"L5"}),baseQuestion({rbtLevel:"L6"})]);
    const ratio=computeCBR(data,computeLOTS(data),computeHOTS(data));
    expect(ratio.rawValue).toBe(2);
    expect(ratio.value).toBe(1);
  });
  it("does not substitute prose length, diversity or approval for academic quality", () => {
    const data = makeData([baseQuestion({questionText:"Explain ".repeat(80), clarityScore:1,questionType:"Theory",questionStatus:"APPROVED"})]);
    for (const fn of [computeQCQI,computeAMI,computeFRI,computeCAI]) expect(fn(data).value).toBeNull();
  });
  it("QCQI requires seven complete, source-backed review dimensions", () => {
    const evidence = ["clarity","precision","technicalAccuracy","context","validity","alignment","fairness"]
      .map(criterion=>({criterion,score:.7,sourceIds:["review-1"]}));
    const data = makeData([baseQuestion()],{academicEvidence:{QCQI:evidence}});
    expect(computeQCQI(data).value).toBeCloseTo(.7);
    expect(computeQCQI({...data,academicEvidence:{QCQI:evidence.slice(1)}}).value).toBeNull();
    expect(computeQCQI({...data,academicEvidence:{QCQI:evidence.map(e=>({...e,sourceIds:[]}))}}).value).toBeNull();
  });
  it("AMI/FRI accept documented criteria rather than inferred question properties", () => {
    const rows = (criteria:string[]) => criteria.map(criterion=>({criterion,score:0,sourceIds:["moderation-1"]}));
    expect(computeAMI(makeData([baseQuestion()],{academicEvidence:{AMI:rows(["validity","reliability","fairness","transparency","traceability","consistency","governanceCompliance"])}})).value).toBe(0);
    expect(computeFRI(makeData([baseQuestion()],{academicEvidence:{FRI:rows(["hotsIntegration","industryRelevance","employabilitySkills","problemSolving","innovation","criticalThinking","graduateAttributes"])}})).value).toBe(0);
  });
});

const core = ["SCI","MII","BDI","CVI","MCAI","DBI","QCQI","CAI","AMI","FRI"];
function metrics(codes=core, value:number|null=.8):MetricResult[] {
  return codes.map(indexCode=>({indexCode:indexCode as MetricResult["indexCode"],value,classification:null,weight:null,computationOrder:0,formulaUsed:"fixture"}));
}
describe("complete composites and independent confidence", () => {
  it("QPQI preserves fixed weights and requires every component exactly once", () => {
    const all = metrics();
    expect(computeQPQI(all).value).toBeCloseTo(.8);
    expect(computeQPQI(all.slice(1)).value).toBeNull();
    expect(computeQPQI([...all,{...all[0]}]).value).toBeNull();
    expect(computeQPQI(all.map((m,i)=>i===0?{...m,value:null}:m)).value).toBeNull();
    expect(computeQPQI(all.map(m=>({...m,value:m.indexCode==="BDI"?1:0}))).value).toBe(.15);
  });
  it("MII requires all nine components", () => {
    const all = metrics(["COA","POA","PIA","RBTA","DA","MAA","QTA","MC","MCS"]);
    expect(computeMII(all).value).toBeCloseTo(.8);
    expect(computeMII(all.slice(1)).value).toBeNull();
    expect(computeMII(all.map(m=>({...m,value:null}))).value).toBeNull();
  });
  it("OCI averages ten explicit confidence scores, regardless of quality", () => {
    const all = metrics().map(m=>({...m,value:.1,confidenceScore:.9}));
    const oci=computeOCI(all);
    expect(oci.value).toBeCloseTo(.9);
    expect(oci.classification).toBeNull();
    expect(oci.confidenceClassification).toBe("VERY_HIGH");
    expect(computeOCI(metrics()).value).toBeNull();
    expect(computeOCI(all.slice(1)).value).toBeNull();
    expect(computeOCI([...all,{...all[0]}]).value).toBeNull();
  });
  it("rejects invalid confidence counts and nonfinite quality values", () => {
    for (const [verified,required] of [[0,0],[15,10],[-1,10],[NaN,10],[1,Infinity]]) expect(computeConfidence(verified,required).score).toBeNull();
    expect(computeConfidence(3,4)).toEqual({score:.75,percentage:75,classification:"MEDIUM"});
    expect(computeConfidence(0,10).score).toBe(0);
    for (const value of [NaN,Infinity,-.1,1.1]) {
      expect(classifyIndex(value)).toBeNull();
      expect(classifyConfidence(value)).toBeNull();
    }
  });
  it.each([[.9,"EXEMPLARY"],[.8,"HIGHLY_EFFECTIVE"],[.7,"EFFECTIVE"],[.6,"ACCEPTABLE"],[.5,"NEEDS_IMPROVEMENT"],[0,"MAJOR_REVISION_REQUIRED"]] as const)("classifies %s", (value,label) => {
    expect(classifyIndex(value)).toBe(label);
  });
  it("computes 26 metrics with optional confidence evidence and null empty-bank quality", () => {
    const data=makeData([baseQuestion()],{indexConfidence:Object.fromEntries(core.map(c=>[c,{verified:8,required:10}]))});
    const results=new MetricEngine().computeAll(data);
    expect(results).toHaveLength(26);
    expect(new Set(results.map(r=>r.indexCode)).size).toBe(26);
    // Core counts cannot be overridden by caller-provided confidence numbers.
    expect(results.find(r=>r.indexCode==="BDI")?.confidenceScore).toBe(0);
    expect(results.find(r=>r.indexCode==="SCI")?.confidenceScore).toBe(0);
    expect(results.find(r=>r.indexCode==="OCI")?.value).not.toBeCloseTo(.8);
    expect(results.find(r=>r.indexCode==="QPQI")?.value).toBeNull();
    for (const m of new MetricEngine().computeAll(makeData([]))) expect(m.value).toBeNull();
  });
});
