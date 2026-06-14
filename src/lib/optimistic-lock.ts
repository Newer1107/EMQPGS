import { Prisma } from "@prisma/client";
import { ConflictError } from "@/lib/errors";

export function withOptimisticLock<T>(
  update: () => Promise<T>,
  entityName = "Resource",
): Promise<T> {
  return update().catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new ConflictError(
        `${entityName} was modified by another request. Refresh and try again.`,
      );
    }
    throw err;
  });
}

export function buildOptimisticUpdate<T extends Record<string, unknown>>(
  data: T,
): T & { version: { increment: number } } {
  return { ...data, version: { increment: 1 } };
}

export function buildOptimisticWhere(
  id: string,
  version: number,
): { id: string; version: number } {
  return { id, version };
}
