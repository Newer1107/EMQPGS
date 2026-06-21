import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getAuditService } from "@/lib/auth/audit-service";
import { SECURITY_ACTIONS, ENTITY_TYPES } from "@/lib/constants";

const APPROVAL_TTL_MINUTES = 30;

export class EmergencyApprovalService {
  /**
   * Request an emergency action. Creates a PENDING approval.
   */
  async request(action: string, reason: string, requestedBy: string, targetUserId?: string) {
    const approval = await prisma.emergencyApproval.create({
      data: {
        action,
        reason,
        requestedById: requestedBy,
        targetUserId: targetUserId ?? null,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MINUTES * 60 * 1000),
      },
    });

    await getAuditService().log({
      actorId: requestedBy,
      action: SECURITY_ACTIONS.EMERGENCY_REQUESTED,
      entityType: ENTITY_TYPES.EMERGENCY_APPROVAL,
      entityId: approval.id,
      metadata: { action, reason },
    });

    return approval;
  }

  /**
   * Approve a pending request. Must be a DIFFERENT COE user than the requester.
   */
  async approve(approvalId: string, approvedBy: string) {
    const approval = await prisma.emergencyApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new AppError("Approval request not found", 404);
    if (approval.status !== "PENDING") throw new AppError("Approval request is not pending", 400);
    if (approval.requestedById === approvedBy) throw new AppError("Cannot approve your own request", 403);
    if (approval.expiresAt < new Date()) {
      await prisma.emergencyApproval.update({ where: { id: approvalId }, data: { status: "EXPIRED" } });
      throw new AppError("Approval request has expired", 410);
    }

    const updated = await prisma.emergencyApproval.update({
      where: { id: approvalId },
      data: { status: "APPROVED", approvedById: approvedBy, approvedAt: new Date() },
    });

    await getAuditService().log({
      actorId: approvedBy,
      action: SECURITY_ACTIONS.EMERGENCY_APPROVED,
      entityType: ENTITY_TYPES.EMERGENCY_APPROVAL,
      entityId: approvalId,
      metadata: { action: approval.action, requestedById: approval.requestedById },
    });

    return updated;
  }

  /**
   * Reject a pending request.
   */
  async reject(approvalId: string, rejectedBy: string, reason?: string) {
    const approval = await prisma.emergencyApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new AppError("Approval request not found", 404);
    if (approval.status !== "PENDING") throw new AppError("Approval request is not pending", 400);

    const updated = await prisma.emergencyApproval.update({
      where: { id: approvalId },
      data: { status: "REJECTED" },
    });

    await getAuditService().log({
      actorId: rejectedBy,
      action: SECURITY_ACTIONS.EMERGENCY_REJECTED,
      entityType: ENTITY_TYPES.EMERGENCY_APPROVAL,
      entityId: approvalId,
      metadata: { action: approval.action, reason },
    });

    return updated;
  }

  /**
   * Execute the approved action. Only works if status === "APPROVED".
   * Returns the action type so the caller knows what to execute.
   */
  async execute(approvalId: string): Promise<string> {
    const approval = await prisma.emergencyApproval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new AppError("Approval request not found", 404);
    if (approval.status !== "APPROVED") throw new AppError("Approval request is not approved", 400);

    await prisma.emergencyApproval.update({
      where: { id: approvalId },
      data: { status: "EXECUTED" },
    });

    await getAuditService().log({
      actorId: approval.approvedById ?? undefined,
      action: SECURITY_ACTIONS.EMERGENCY_EXECUTED,
      entityType: ENTITY_TYPES.EMERGENCY_APPROVAL,
      entityId: approvalId,
      metadata: { action: approval.action },
    });

    return approval.action;
  }

  /**
   * Get pending approvals (for dashboard display).
   */
  async getPending() {
    // Expire any overdue requests
    await prisma.emergencyApproval.updateMany({
      where: { status: "PENDING", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });

    return prisma.emergencyApproval.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "desc" },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
