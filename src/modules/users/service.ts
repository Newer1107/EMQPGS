import bcrypt from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { UserRepository } from "@/modules/users/repository";
import { UserInput } from "@/modules/users/validation";

export class UserService {
  constructor(private readonly repository = new UserRepository()) {}

  list() {
    return this.repository.list();
  }

  findByEmail(email: string) {
    return this.repository.findByEmail(email);
  }

  async create(data: UserInput) {
    const existing = await this.repository.findByEmail(data.email);
    if (existing) throw new AppError("Email already exists", 409);
    if (!data.password) throw new AppError("Password is required", 400);
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.repository.create({ ...data, passwordHash });
  }

  async update(id: string, data: Partial<UserInput>) {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError("User not found");

    const payload: Partial<UserInput> & { passwordHash?: string } = { ...data };
    if (data.password) {
      payload.passwordHash = await bcrypt.hash(data.password, 12);
      delete payload.password;
    }

    return this.repository.update(id, payload);
  }

  async disable(id: string) {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return this.repository.update(id, { status: UserStatus.DISABLED });
  }

  async verifyCredentials(email: string, password: string) {
    const user = await this.repository.findByEmail(email);
    if (!user) throw new AppError("Invalid credentials", 401);
    if (user.status === UserStatus.DISABLED) throw new AppError("Account disabled", 403);
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new AppError("Invalid credentials", 401);
    return user;
  }
}
