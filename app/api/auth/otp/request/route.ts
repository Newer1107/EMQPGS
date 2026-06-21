import { NextRequest } from "next/server";
import { z } from "zod";
import { decodeJwt } from "jose";
import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { OtpService, type OtpPurpose } from "@/lib/auth/otp-service";
import { authCookieNames } from "@/lib/jwt";
import { logAudit } from "@/lib/audit";
import { SECURITY_ACTIONS, ENTITY_TYPES } from "@/lib/constants";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import { getBrowserFingerprintFromRequest } from "@/lib/auth/browser-fingerprint";

const requestSchema = z.object({
  purpose: z.enum([
    "DEAN_REVEAL",
    "DEAN_APPROVE",
    "DEAN_DOWNLOAD",
    "COE_DOWNLOAD",
    "COE_MARK_USED",
    "COE_ARCHIVE",
    "COE_EXPORT",
  ]),
  resourceId: z.string().optional(),
});

export const POST = withApiHandler(
  async (request: NextRequest, { user, auth }) => {
    const payload = requestSchema.parse(await request.json());

    // Extract session JTI from the access token cookie
    const accessToken = request.cookies.get(authCookieNames.access)?.value;
    const sessionId = accessToken ? (decodeJwt(accessToken).jti as string) ?? "" : "";

    // Purpose-specific responsibility check: ensure the user has the
    // correct responsibility for the requested OTP purpose.
    const deanPurposes = new Set(["DEAN_REVEAL", "DEAN_APPROVE", "DEAN_DOWNLOAD"]);
    const coePurposes = new Set(["COE_DOWNLOAD", "COE_MARK_USED", "COE_ARCHIVE", "COE_EXPORT"]);

    if (deanPurposes.has(payload.purpose)) {
      new AuthorizationService(auth!).requireDean();
    } else if (coePurposes.has(payload.purpose)) {
      new AuthorizationService(auth!).requireCoe();
    }

    const browserFingerprint = getBrowserFingerprintFromRequest(request);
    const otpService = new OtpService();
    const result = await otpService.create({
      userId: user!.id,
      purpose: payload.purpose as OtpPurpose,
      resourceId: payload.resourceId,
      sessionId,
      browserFingerprint,
    });

    // Audit the OTP request event
    await logAudit({
      actorId: user!.id,
      action: SECURITY_ACTIONS.OTP_REQUESTED,
      entityType: ENTITY_TYPES.OTP_CODE,
      metadata: {
        purpose: payload.purpose,
        resourceId: payload.resourceId,
        sessionId,
        expiresAt: result.expiresAt.toISOString(),
      },
    });

    // NEVER return the code — only the expiry timestamp
    return { expiresAt: result.expiresAt };
  },
  {
    responsibility: [ResponsibilityType.DEAN, ResponsibilityType.COE],
  },
);
