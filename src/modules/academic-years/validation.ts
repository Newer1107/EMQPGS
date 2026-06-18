import { AcademicYearStatus } from "@prisma/client";
import { z } from "zod";

export const academicYearSchema = z.object({
  code: z.string().regex(/^\d{4}-\d{4}$/),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.nativeEnum(AcademicYearStatus).optional(),
});

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
