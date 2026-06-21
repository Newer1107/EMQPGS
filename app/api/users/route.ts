import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AuthorizationService } from "@/lib/auth/authorization-service";

import { UserService } from "@/modules/users/service";
import { userSchema } from "@/modules/users/validation";

const service = new UserService();

export const GET = withApiHandler(async (request, context) => {
  const take = parseInt(request.nextUrl.searchParams.get("take") ?? "50", 10);
  const skip = parseInt(request.nextUrl.searchParams.get("skip") ?? "0", 10);
  const role = request.nextUrl.searchParams.get("role") as ResponsibilityType | null;

  const authz = new AuthorizationService(context.auth!);
  if (authz.has("COORDINATOR" as ResponsibilityType)) {
    if (role !== ("CONTRIBUTOR" as ResponsibilityType) && role !== ("MODERATOR" as ResponsibilityType)) {
      return [];
    }
  }

  return service.list(take, skip);
}, { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });

export const POST = withApiHandler(
  async (request) => {
    const payload = userSchema.parse(await request.json());
    return service.create(payload);
  },
  {
    responsibility: ["COE" as ResponsibilityType],
    audit: {
      action: "USER_CREATED",
      entityType: "USER",
      getEntityId: (result) => (result as { id?: string }).id,
    },
  },
);
