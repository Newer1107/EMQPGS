import type { User } from "@prisma/client";
export type Actor = Pick<User, "id" | "role" | "email" | "name">;
