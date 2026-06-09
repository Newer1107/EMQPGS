import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";

export const userSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  departmentId: z.string().nullable().optional(),
  role: z.nativeEnum(Role),
  status: z.nativeEnum(UserStatus).optional(),
  password: z.string().min(8).optional(),
});

export type UserInput = z.infer<typeof userSchema>;
