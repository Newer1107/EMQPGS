import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { UserService } from "@/modules/users/service";
import { userSchema } from "@/modules/users/validation";

const service = new UserService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = userSchema.partial().parse(await request.json());
    return service.update(id, payload);
  },
  {
    responsibility: ["COE" as ResponsibilityType],
    audit: {
      action: "USER_UPDATED",
      entityType: "USER",
      getEntityId: (result) => (result as { id?: string }).id,
    },
  },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.disable(id);
  },
  {
    responsibility: ["COE" as ResponsibilityType],
    audit: {
      action: "USER_DISABLED",
      entityType: "USER",
      getEntityId: (result) => (result as { id?: string }).id,
    },
  },
);
