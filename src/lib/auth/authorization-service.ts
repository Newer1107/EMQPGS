import type { ResponsibilityType, ScopeType } from "@prisma/client";
import type { AuthContext } from "@/lib/types";
import { ForbiddenError } from "@/lib/errors";

/**
 * Centralized authorization layer.
 *
 * Every authorization decision in the system reduces to:
 *   "Does this user have this responsibility within this scope?"
 *
 * Usage:
 *   AuthorizationService.requireCoordinator(context, departmentId)
 *   AuthorizationService.requireModerator(context, questionBankId)
 *   AuthorizationService.requireContributor(context, questionBankId)
 *   AuthorizationService.requireAny(context, [responsibilityType, ...])
 */
export class AuthorizationService {
  constructor(private readonly context: AuthContext) {}

  /**
   * Check if the user has a specific responsibility type and optional scope.
   */
  has(responsibility: ResponsibilityType, scopeType?: ScopeType, scopeId?: string): boolean {
    return this.context.responsibilities.some((r) => {
      if (r.type !== responsibility) return false;
      if (scopeType !== undefined && r.scopeType !== scopeType) return false;
      if (scopeId !== undefined && r.scopeId !== scopeId) return false;
      return true;
    });
  }

  /**
   * Check if the user has ANY of the given responsibility types.
   */
  hasAny(responsibilities: ResponsibilityType[]): boolean {
    return responsibilities.some((rt) => this.context.responsibilities.some((r) => r.type === rt));
  }

  /**
   * Check if the user has ALL of the given responsibility types.
   */
  hasAll(responsibilities: ResponsibilityType[]): boolean {
    return responsibilities.every((rt) => this.context.responsibilities.some((r) => r.type === rt));
  }

  /**
   * Get the scope ID for the first matching responsibility of a given type.
   */
  getScopeId(responsibility: ResponsibilityType, scopeType?: ScopeType): string | null {
    const match = this.context.responsibilities.find(
      (r) => r.type === responsibility && (scopeType === undefined || r.scopeType === scopeType),
    );
    return match?.scopeId ?? null;
  }

  /**
   * Get all scope IDs for a given responsibility type.
   */
  getScopeIds(responsibility: ResponsibilityType, scopeType?: ScopeType): string[] {
    return this.context.responsibilities
      .filter((r) => r.type === responsibility && (scopeType === undefined || r.scopeType === scopeType))
      .map((r) => r.scopeId)
      .filter((id): id is string => id !== null);
  }

  // ─── Convenience methods ───

  require(responsibility: ResponsibilityType, scopeType?: ScopeType, scopeId?: string): void {
    if (!this.has(responsibility, scopeType, scopeId)) {
      const scope = scopeId ? ` for scope ${scopeType}:${scopeId}` : "";
      throw new ForbiddenError(`Requires ${responsibility} responsibility${scope}.`);
    }
  }

  requireAny(responsibilities: ResponsibilityType[]): void {
    if (!this.hasAny(responsibilities)) {
      throw new ForbiddenError(`Requires one of: ${responsibilities.join(", ")}.`);
    }
  }

  requireCoordinator(departmentId?: string): void {
    this.require("COORDINATOR" as ResponsibilityType, departmentId ? ("DEPARTMENT" as ScopeType) : undefined, departmentId);
  }

  requireModerator(questionBankId?: string): void {
    this.require("MODERATOR" as ResponsibilityType, questionBankId ? ("QUESTION_BANK" as ScopeType) : undefined, questionBankId);
  }

  requireContributor(questionBankId?: string): void {
    this.require("CONTRIBUTOR" as ResponsibilityType, questionBankId ? ("QUESTION_BANK" as ScopeType) : undefined, questionBankId);
  }

  requireCoe(): void {
    this.require("COE" as ResponsibilityType, "INSTITUTION" as ScopeType);
  }

  requireDean(): void {
    this.require("DEAN" as ResponsibilityType, "INSTITUTION" as ScopeType);
  }
}
