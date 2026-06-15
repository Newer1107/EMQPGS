import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { UserService } from "@/modules/users/service";
import { userSchema } from "@/modules/users/validation";

const service = new UserService();

export const GET = withApiHandler(async (request, context) => {
  if (context.user!.role === Role.COORDINATOR) {
    const role = request.nextUrl.searchParams.get("role");
    if (role !== Role.CONTRIBUTOR) {
      return [];
    }
    return service.list();
  }

  return service.list();
}, { roles: [Role.COE, Role.COORDINATOR] });

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
