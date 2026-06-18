import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { ContributorAssignmentService } from "@/modules/contributor-assignments/service";
import { contributorAssignmentSchema } from "@/modules/contributor-assignments/validation";

const service = new ContributorAssignmentService();

export const POST = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const payload = contributorAssignmentSchema.parse(await request.json());
    return service.assignContributor(questionBankId, payload);
  },
  {
    roles: [Role.COORDINATOR],
    successStatus: 201,
    audit: {
      action: "CONTRIBUTOR_ASSIGNED",
      entityType: "QUESTION_BANK",
      getEntityId: () => null,
      getMetadata: (request) => ({ questionBankId: request.nextUrl.pathname.split("/").slice(-3)[0]! }),
    },
  },
);

export const DELETE = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const contributorId = request.nextUrl.searchParams.get("contributorId");
    if (!contributorId) {
      throw new Error("contributorId query parameter is required");
    }
    return service.unassignContributor(questionBankId, contributorId);
  },
  {
    roles: [Role.COORDINATOR],
    successStatus: 200,
    audit: {
      action: "CONTRIBUTOR_UNASSIGNED",
      entityType: "QUESTION_BANK",
      getEntityId: () => null,
      getMetadata: (request) => ({ questionBankId: request.nextUrl.pathname.split("/").slice(-3)[0]!, contributorId: request.nextUrl.searchParams.get("contributorId") }),
    },
  },
);

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    return service.listAssignments(questionBankId);
  },
  {
    roles: [Role.COORDINATOR],
    successStatus: 200,
  },
);
