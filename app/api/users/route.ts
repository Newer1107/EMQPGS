import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { UserService } from "@/modules/users/service";
import { userSchema } from "@/modules/users/validation";

const service = new UserService();

export const GET = withApiHandler(async (request, context) => {
  const take = parseInt(request.nextUrl.searchParams.get("take") ?? "50", 10);
  const skip = parseInt(request.nextUrl.searchParams.get("skip") ?? "0", 10);
  const role = request.nextUrl.searchParams.get("role") as Role | null;

  if (context.user!.role === Role.COORDINATOR) {
    if (role !== Role.CONTRIBUTOR && role !== Role.MODERATOR) {
      return [];
    }
  }

  return service.list(take, skip, role ?? undefined);
}, { roles: [Role.COE, Role.COORDINATOR] });

export const POST = withApiHandler(
  async (request) => {
    const payload = userSchema.parse(await request.json());
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
