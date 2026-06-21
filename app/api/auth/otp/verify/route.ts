import { NextRequest } from "next/server";
import { z } from "zod";
import { decodeJwt } from "jose";
import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { OtpService, type OtpPurpose } from "@/lib/auth/otp-service";
import { StepUpService } from "@/lib/auth/step-up-service";
import { authCookieNames } from "@/lib/jwt";
import { getBrowserFingerprintFromRequest } from "@/lib/auth/browser-fingerprint";

const verifySchema = z.object({
  purpose: z.enum([
    "DEAN_REVEAL",
    "DEAN_APPROVE",
    "DEAN_DOWNLOAD",
    "COE_DOWNLOAD",
    "COE_MARK_USED",
    "COE_ARCHIVE",
    "COE_EXPORT",
  ]),
  code: z.string().min(1, "OTP code is required"),
  resourceId: z.string().optional(),
});

export const POST = withApiHandler(
  async (request: NextRequest, { user }) => {
    const payload = verifySchema.parse(await request.json());

    // Extract session JTI from the access token cookie
    const accessToken = request.cookies.get(authCookieNames.access)?.value;
    const sessionId = accessToken ? (decodeJwt(accessToken).jti as string) ?? "" : "";

    const otpService = new OtpService();
    const stepUpService = new StepUpService();

    // Verify the OTP — throws on invalid/expired/replayed codes
    await otpService.verify(
      {
        userId: user!.id,
        purpose: payload.purpose as OtpPurpose,
        resourceId: payload.resourceId,
        sessionId,
      },
      payload.code,
    );

    // On success, establish the step-up session with browser binding
    const browserFingerprint = getBrowserFingerprintFromRequest(request);
    await stepUpService.setVerified(user!.id, payload.purpose, payload.resourceId, browserFingerprint);

    return { verified: true };
  },
  {
    responsibility: [ResponsibilityType.DEAN, ResponsibilityType.COE],
  },
);
