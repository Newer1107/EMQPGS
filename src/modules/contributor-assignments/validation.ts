import { z } from "zod";

export const contributorAssignmentSchema = z.object({
  contributorId: z.string().min(1, "Contributor is required"),
});

export type ContributorAssignmentInput = z.infer<typeof contributorAssignmentSchema>;
