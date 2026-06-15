import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { SubjectVersionService } from "@/modules/subject-versions/service";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

const service = new SubjectVersionService();
const deptUtils = new DepartmentAccessUtils();

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;

    const version = await prisma.subjectVersion.findUnique({
      where: { id },
      include: { subject: { select: { departmentId: true } } },
    });
    if (!version) throw new NotFoundError("Subject version not found");
    await deptUtils.assertDepartmentAccess(context.user!, version.subject.departmentId);

    return service.archive(id);
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_VERSION_ARCHIVED", entityType: "SUBJECT_VERSION" } },
);
