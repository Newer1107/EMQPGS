import { BaseRepository } from "@/modules/shared/base-repository";
import { UserInput } from "@/modules/users/validation";

const publicUserInclude = {
  department: true,
} as const;

export class UserRepository extends BaseRepository {
  list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: publicUserInclude,
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: publicUserInclude });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, include: publicUserInclude });
  }

  findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({ where: { email }, include: publicUserInclude });
  }

  create(data: Omit<UserInput, "password"> & { passwordHash: string }) {
    return this.prisma.user.create({ data, include: publicUserInclude });
  }

  update(id: string, data: Partial<Omit<UserInput, "password"> & { passwordHash?: string }>) {
    return this.prisma.user.update({ where: { id }, data, include: publicUserInclude });
  }
}
