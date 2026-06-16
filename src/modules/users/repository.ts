import { BaseRepository } from "@/modules/shared/base-repository";
import { UserInput } from "@/modules/users/validation";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  departmentId: true,
  resetTokenExpiry: true,
  createdAt: true,
  updatedAt: true,
  department: true,
} as const;

const authUserSelect = {
  ...publicUserSelect,
  passwordHash: true,
  resetTokenHash: true,
} as const;

export class UserRepository extends BaseRepository {
  list(take = 50, skip = 0) {
    return this.prisma.user.findMany({
      take: Math.min(take, 500),
      skip,
      orderBy: { createdAt: "desc" },
      select: publicUserSelect,
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: publicUserSelect });
  }

  findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: authUserSelect });
  }

  create(data: Omit<UserInput, "password"> & { passwordHash: string }) {
    return this.prisma.user.create({ data, select: publicUserSelect });
  }

  update(id: string, data: Partial<Omit<UserInput, "password"> & { passwordHash?: string }>) {
    return this.prisma.user.update({ where: { id }, data, select: publicUserSelect });
  }
}
