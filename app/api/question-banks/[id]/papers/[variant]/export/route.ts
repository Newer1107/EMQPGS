import { NextResponse } from "next/server";
import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { WordExportService } from "@/modules/paper-generation/word-export.service";
import { StepUpService } from "@/lib/auth/step-up-service";
import { SecurityConfig } from "@/lib/auth/security-config";
import { getWatermarkService } from "@/lib/auth/watermark-service";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getCurrentSessionId } from "@/lib/api-context";
import { generateSecurityEventId } from "@/lib/auth/security-event-id";
import { getBrowserFingerprintFromRequest } from "@/lib/auth/browser-fingerprint";

// Module-level variable so audit callback can capture the securityEventId
let capturedSecurityEventId: string | undefined;

export const GET = withApiHandler(
  async (request, context) => {
    const { user, auth } = context;
    if (!user || !auth) throw new AppError("Unauthorized", 401);

    const segments = request.nextUrl.pathname.split("/");
    const variantIdx = segments.indexOf("papers") + 1;
    const variant = segments[variantIdx];
    const questionBankId = segments[variantIdx - 2];
    const reason = request.nextUrl.searchParams.get("reason") ?? null;

    // Dynamic step-up: DEAN or COE uses its own action
    const isDean = auth.responsibilities.some((r) => r.type === "DEAN" as ResponsibilityType);
    const stepUpAction = isDean ? "DEAN_DOWNLOAD" : "COE_DOWNLOAD";
    const browserFingerprint = getBrowserFingerprintFromRequest(request);

    capturedSecurityEventId = generateSecurityEventId();

    const cfg = SecurityConfig.getInstance();
    if (!cfg.getFeatures().downloadsEnabled) {
      throw new AppError("Downloads are disabled in the current security mode.", 403, "DOWNLOADS_DISABLED");
    }
    if (cfg.isStepUpRequired()) {
      await new StepUpService().requireVerified(user.id, stepUpAction, questionBankId, browserFingerprint);
    }

    // Build watermark context
    const wm = getWatermarkService();
    const downloadId = wm.generateDownloadId();
    const sessionId = await getCurrentSessionId();
    const roleName = isDean ? "DEAN" : "COE";
    const downloadTimestamp = new Date();
    const watermarkLines = wm.getDocxWatermarkLines({
      userName: user.name || user.email,
      userEmail: user.email,
      userRole: roleName,
      sessionId: sessionId ?? "",
      documentId: questionBankId,
      downloadId,
      timestamp: downloadTimestamp,
    });

    // Export with watermark
    const service = new WordExportService();
    const result = await service.export(questionBankId, variant, "docx", watermarkLines);

    // Record the download for forensic tracing
    const securityEventId = generateSecurityEventId();
    await prisma.paperDownload.create({
      data: {
        downloadId,
        paperId: result.paperId,
        variant,
        downloadedById: user.id,
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
        userAgent: request.headers.get("user-agent") ?? null,
        sessionId: sessionId ?? undefined,
        downloadReason: reason,
        securityEventId,
      },
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mime,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  },
  {
    responsibility: ["DEAN" as ResponsibilityType, "COE" as ResponsibilityType],
    audit: {
      action: "PAPER_DOWNLOADED",
      entityType: "GENERATED_PAPER",
      getMetadata: (request) => ({
        reason: request.nextUrl.searchParams.get("reason") ?? null,
        securityEventId: capturedSecurityEventId,
      }),
    },
    responseType: "raw" as const,
  },
);
