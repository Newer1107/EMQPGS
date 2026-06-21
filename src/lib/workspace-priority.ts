/**
 * Workspace priority configuration.
 *
 * Determines auto-selection order when a user has multiple active
 * responsibilities but no explicit workspace cookie.
 *
 * Higher number = higher priority.
 * This is a user experience concern, NOT an authorization concern.
 */
export const WORKSPACE_PRIORITY: Record<string, number> = {
  COE: 5,
  DEAN: 4,
  COORDINATOR: 3,
  MODERATOR: 2,
  CONTRIBUTOR: 1,
};
