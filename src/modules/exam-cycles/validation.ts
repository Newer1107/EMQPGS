import { ExamCycleStatus, ExamType } from "@prisma/client";
import { z } from "zod";

const timetableRowSchema = z.object({
  dateDay: z.string().trim().min(1),
  time: z.string().trim().min(1),
  paper: z.string().trim().min(1),
});

export const examCycleSchema = z.object({
  academicYearId: z.string().min(1),
  semesterId: z.string().min(1),
  examType: z.nativeEnum(ExamType),
  status: z.nativeEnum(ExamCycleStatus).optional(),
  departmentId: z.string().min(1).nullable().optional(),
  timetableDocumentRef: z.string().trim().min(1),
  timetableIssueDate: z.coerce.date(),
  timetableTitle: z.string().trim().min(1),
  timetableRows: z.array(timetableRowSchema).min(1),
  timetableSignature: z.string().trim().min(1),
});

export type ExamCycleInput = z.infer<typeof examCycleSchema>;
