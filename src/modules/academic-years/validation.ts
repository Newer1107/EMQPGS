import { AcademicYearStatus } from "@prisma/client";
import { z } from "zod";

export const academicYearSchema = z.object({
  code: z.string().regex(/^\d{4}-\d{4}$/),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.nativeEnum(AcademicYearStatus).optional(),
});

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
