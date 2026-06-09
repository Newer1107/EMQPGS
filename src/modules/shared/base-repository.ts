import { prisma } from "@/lib/db";

export abstract class BaseRepository {
  protected readonly prisma = prisma;
}
