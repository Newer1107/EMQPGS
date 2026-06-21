import { ResponsibilityType, UserStatus } from "@prisma/client";
import { z } from "zod";

export const userSchema = z.object({
  name: z.string().min(2).regex(/^[^<>&"]+$/, "Must not contain HTML special characters"),
  email: z.email(),
  homeDepartmentId: z.string().min(1).nullable().optional(),
  responsibility: z.nativeEnum(ResponsibilityType).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  password: z.string().min(8).optional(),
});

export type UserInput = z.infer<typeof userSchema>;
