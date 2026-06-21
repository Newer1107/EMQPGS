import type { ResponsibilityType, ScopeType } from "@prisma/client";

export type Actor = {
  id: string;
  email: string;
  name: string;
};

export type ResponsibilityInfo = {
  id: string;
  type: ResponsibilityType;
  scopeType: ScopeType;
  scopeId: string | null;
  activeFrom: Date;
  activeTo: Date | null;
};

export type AuthContext = {
  user: Actor;
  responsibilities: ResponsibilityInfo[];
};

/** Step-Up action descriptor for the step-up guard. */
export type StepUpDescriptor = {
  action: string;
  resourceId?: string;
  purpose?: string;
};
