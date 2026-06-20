// User-facing error messages — single source of truth for every string a user sees.
// Frontend code references by key; never embeds raw strings in catch blocks.
// Keep sorted by key.

export const UserError = {
  // ── Generic ──────────────────────────────────────
  UNEXPECTED: {
    title: "Unexpected error",
    message: "An unexpected error occurred. Please try again.",
    systemImpact: "The operation could not be completed.",
  },
  NETWORK: {
    title: "Connection lost",
    message: "Unable to reach the server. Please check your connection.",
    systemImpact: "The operation could not be completed.",
  },
  UNKNOWN: {
    title: "Unknown error",
    message: "An unknown error occurred. Please try again.",
    systemImpact: "No changes were made.",
  },
  NOT_FOUND_PAGE: {
    title: "Page not found",
    message: "The page you are looking for does not exist or has been moved.",
    systemImpact: "",
  },

  // ── Validation ───────────────────────────────────
  VALIDATION_FAILED: {
    title: "Please review the form",
    message: "One or more fields need attention. Check the highlighted fields and try again.",
    systemImpact: "No changes were saved.",
  },
  FIELD_REQUIRED: {
    title: "Required field missing",
    message: "Please fill in all required fields before continuing.",
    systemImpact: "",
  },

  // ── Data ──────────────────────────────────────────
  NOT_FOUND: {
    title: "Not found",
    message: "The requested resource was not found. It may have been deleted.",
    systemImpact: "",
  },
  DUPLICATE: {
    title: "Already exists",
    message: "A record with this value already exists. Please use a different value.",
    systemImpact: "No changes were made.",
  },
  OPTIMISTIC_LOCK: {
    title: "Conflict",
    message: "This record was modified by another user. Please refresh and try again.",
    systemImpact: "Your changes were not saved.",
  },

  // ── Permissions ──────────────────────────────────
  UNAUTHORIZED: {
    title: "Sign in required",
    message: "Please sign in to continue.",
    systemImpact: "",
  },
  FORBIDDEN: {
    title: "Access denied",
    message: "You do not have permission to perform this action.",
    systemImpact: "",
  },
  RATE_LIMITED: {
    title: "Too many requests",
    message: "Please wait a moment before trying again.",
    systemImpact: "",
  },

  // ── State Transitions ────────────────────────────
  INVALID_STATE: {
    title: "Cannot perform this action",
    message: "The current state of this resource does not allow this operation.",
    systemImpact: "No changes were made.",
  },
  SLOT_LOCKED: {
    title: "Slot locked",
    message: "This slot cannot be modified because the question bank has advanced past the drafting phase.",
    systemImpact: "No changes were made.",
  },

  // ── Business Rules ───────────────────────────────
  PREREQUISITE_MISSING: {
    title: "Prerequisite not met",
    message: "Complete all required steps before proceeding.",
    systemImpact: "The operation could not be started.",
  },
  MINIMUM_THRESHOLD: {
    title: "Minimum not met",
    message: "This operation requires more data. Add more items and try again.",
    systemImpact: "The operation could not be completed.",
  },
  DEAN_REVIEW_LOCKED: {
    title: "Review already submitted",
    message: "A dean selection has already been submitted for this question bank.",
    systemImpact: "No changes were made.",
  },
} as const;

export type UserErrorKey = keyof typeof UserError;

export interface UserErrorMessage {
  title: string;
  message: string;
  systemImpact: string;
}
