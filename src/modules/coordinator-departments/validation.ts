import { z } from "zod";

export const coordinatorDepartmentAssignmentSchema = z.object({
  coordinatorId: z.string().min(1, "Coordinator is required"),
  departmentId: z.string().min(1, "Department is required"),
});

export type CoordinatorDepartmentAssignmentInput = z.infer<typeof coordinatorDepartmentAssignmentSchema>;
