import { z } from "zod";

export const teachingGroupSchema = z.object({
  batchId: z.string().min(1, "Batch is required"),
  groupNumber: z.number().int().min(1).max(2),
  name: z.string().trim().min(1, "Group name is required").max(200),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const teachingGroupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const teachingGroupBulkSchema = z.object({
  batchId: z.string().min(1, "Batch is required"),
  groups: z.array(
    z.object({
      groupNumber: z.number().int().min(1).max(2),
      name: z.string().trim().min(1, "Group name is required").max(200),
      description: z.string().trim().optional(),
    }),
  ).min(1).max(2),
});

export type TeachingGroupInput = z.infer<typeof teachingGroupSchema>;
export type TeachingGroupUpdateInput = z.infer<typeof teachingGroupUpdateSchema>;
export type TeachingGroupBulkInput = z.infer<typeof teachingGroupBulkSchema>;
