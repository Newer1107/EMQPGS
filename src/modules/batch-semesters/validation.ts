import { BatchSemesterStatus } from "@prisma/client";
import { z } from "zod";

export const batchSemesterUpdateSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.nativeEnum(BatchSemesterStatus).optional(),
  departmentId: z.string().min(1).optional(),
});

export const batchSemesterActivateSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type BatchSemesterUpdateInput = z.infer<typeof batchSemesterUpdateSchema>;
export type BatchSemesterActivateInput = z.infer<typeof batchSemesterActivateSchema>;
