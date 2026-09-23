import { z } from "zod";
import { CRITERIA } from "./criteria";

const percentage = z.number().finite().min(0).max(100);
const co = z.enum(["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"]);
const pair = z.object({ theory: percentage, numerical: percentage }).strict()
  .refine(x => Math.abs(x.theory + x.numerical - 100) < 0.000001, "Theory + numerical must equal 100%.");

export const blueprintSchema = z.object({
  schemaVersion: z.literal(1),
  syllabusReference: z.string().trim().min(1).max(1000),
  table1: z.array(z.object({
    module: z.number().int().min(1).max(100),
    co: z.array(co).min(1).max(6).refine(x => new Set(x).size === x.length, "Duplicate CO."),
    name: z.string().trim().min(1).max(300),
    hours: z.number().finite().positive().max(1000),
  }).strict()).min(1).max(100),
  table2: z.array(z.object({ module: z.number().int().min(1).max(100), ...pair.shape }).strict()
    .refine(x => Math.abs(x.theory + x.numerical - 100) < 0.000001, "Theory + numerical must equal 100%.")).min(1).max(100),
  table3: pair,
}).strict().superRefine((x, ctx) => {
  const a = x.table1.map(r => r.module), b = x.table2.map(r => r.module);
  if (new Set(a).size !== a.length || new Set(b).size !== b.length)
    ctx.addIssue({ code: "custom", message: "Each module must appear exactly once in each table." });
  if (a.length !== b.length || a.some(m => !b.includes(m)))
    ctx.addIssue({ code: "custom", message: "Tables 1 and 2 must contain the same modules." });
});
export type Blueprint = z.infer<typeof blueprintSchema>;

export const assessmentSchema = z.object({
  criterionId: z.string().refine(id => CRITERIA.some(c => c.id === id), "Unknown criterion."),
  answer: z.enum(["YES", "NO"]),
  evidence: z.string().trim().max(8000),
  reason: z.string().trim().max(4000),
}).strict();
export type Assessment = z.infer<typeof assessmentSchema>;
export const draftSchema = z.object({
  remarks: z.string().trim().max(16000),
  assessments: z.array(assessmentSchema).max(100).refine(
    rows => new Set(rows.map(r => r.criterionId)).size === rows.length, "Duplicate criterion."),
}).strict();
export const finalizeSchema = z.object({ draftId: z.string().min(1).max(191) }).strict();

export const EMPTY_BLUEPRINT: Blueprint = {
  schemaVersion: 1, syllabusReference: "",
  table1: [{ module: 1, co: ["CO1"], name: "", hours: 1 }],
  table2: [{ module: 1, theory: 50, numerical: 50 }],
  table3: { theory: 50, numerical: 50 },
};
