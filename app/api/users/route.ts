import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { UserService } from "@/modules/users/service";
import { userSchema } from "@/modules/users/validation";

const service = new UserService();

export const GET = withApiHandler(() => service.list(), { roles: [Role.COE] });

export const POST = withApiHandler(
  async (request) => {
    const payload = userSchema.parse(await parseJson(request));
    return service.create(payload);
  },
  {
    roles: [Role.COE],
    audit: {
      action: "USER_CREATED",
      entityType: "USER",
      getEntityId: (result) => (result as { id?: string }).id,
    },
  },
);
