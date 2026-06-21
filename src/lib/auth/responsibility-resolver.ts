import { prisma } from "@/lib/db";
import type { AuthContext, Actor, ResponsibilityInfo } from "@/lib/types";

/**
 * Loads all active responsibilities for a user from the database.
 * Derives "active" from activeFrom/activeTo dates.
 */
export class ResponsibilityResolver {
  async resolve(userId: string): Promise<ResponsibilityInfo[]> {
    const now = new Date();
    const assignments = await prisma.responsibilityAssignment.findMany({
      where: {
        userId,
        deletedAt: null,
        activeFrom: { lte: now },
        OR: [{ activeTo: null }, { activeTo: { gte: now } }],
      },
      select: {
        id: true,
        responsibility: true,
        scopeType: true,
        scopeId: true,
        activeFrom: true,
        activeTo: true,
      },
    });

    return assignments.map((a) => ({
      id: a.id,
      type: a.responsibility,
      scopeType: a.scopeType,
      scopeId: a.scopeId,
      activeFrom: a.activeFrom,
      activeTo: a.activeTo,
    }));
  }

  async resolveAsContext(userId: string, actor: Actor): Promise<AuthContext> {
    const responsibilities = await this.resolve(userId);
    return { user: actor, responsibilities };
  }
}
