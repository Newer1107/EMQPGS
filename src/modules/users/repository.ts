import { BaseRepository } from "@/modules/shared/base-repository";
import { UserInput } from "@/modules/users/validation";

export class UserRepository extends BaseRepository {
  list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { department: true },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: { department: true } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, include: { department: true } });
  }

  create(data: Omit<UserInput, "password"> & { passwordHash: string }) {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Partial<Omit<UserInput, "password"> & { passwordHash?: string }>) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
