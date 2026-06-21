import { prisma } from "@/lib/db";
import type { UserInput } from "@/modules/users/validation";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  lastLoginAt: true,
  homeDepartmentId: true,
  resetTokenExpiry: true,
  createdAt: true,
  updatedAt: true,
  homeDepartment: true,
} as const;

const authUserSelect = {
  ...publicUserSelect,
  passwordHash: true,
  resetTokenHash: true,
} as const;

export class UserRepository {
  list(take = 50, skip = 0) {
    return prisma.user.findMany({
      take: Math.min(take, 500),
      skip,
      orderBy: { createdAt: "desc" },
      select: publicUserSelect,
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, select: publicUserSelect });
  }

  findByEmailWithPassword(email: string) {
    return prisma.user.findUnique({ where: { email }, select: authUserSelect });
  }

  create(data: Omit<UserInput, "password"> & { passwordHash: string }) {
    return prisma.user.create({ data, select: publicUserSelect });
  }

  update(id: string, data: Partial<Omit<UserInput, "password"> & { passwordHash?: string }>) {
    return prisma.user.update({ where: { id }, data, select: publicUserSelect });
  }
}
