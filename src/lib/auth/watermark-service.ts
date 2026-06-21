import crypto from "node:crypto";
import { SecurityConfig } from "@/lib/auth/security-config";

/**
 * Watermark configuration for a specific download.
 *
 * Every download gets its own unique Download UUID for forensic tracing.
 */
export type WatermarkContext = {
  userName: string;
  userEmail: string;
  userRole: string;
  sessionId: string;
  documentId: string;    // Paper UUID or GeneratedPaper ID
  downloadId: string;     // Unique UUIDv4 per download — embedded in DOCX
  timestamp: Date;
};

/**
 * Watermark Service — generates browser and DOCX watermark content.
 *
 * DESIGN:
 *   - Browser watermark: CSS overlay text (rendered client-side)
 *   - DOCX watermark: Text embedded in the document via docx library
 *   - Every download gets a unique Download UUID
 *   - Both watermarks contain: user, role, email, timestamp, session, doc ID
 *   - DOCX also includes the download UUID for forensic traceability
 *
 * DEVELOPMENT MODE:
 *   - Watermarks are not rendered (browser and DOCX)
 *   - The service still generates watermarks for logging/meta purposes
 *   - Returns empty strings for actual rendering
 */
export class WatermarkService {
  // ─── Download ID generation ─────────────────────────────────────────────

  /** Generate a unique download UUIDv4 for forensic tracing. */
  generateDownloadId(): string {
    return crypto.randomUUID();
  }

  // ─── Browser watermark ──────────────────────────────────────────────────

  /**
   * Get the CSS watermark HTML overlay string.
   * Returns empty string in development mode.
   *
   * @param timestamp - Fresh timestamp for this render (defaults to now).
   *                    Keeps the watermark dynamic per render.
   * @param renderId  - Optional unique ID for this render instance.
   *                    When provided, included in the watermark text so
   *                    no two renders produce identical output, preventing
   *                    screenshot reuse.
   */
  getBrowserWatermarkHTML(ctx: WatermarkContext, timestamp?: Date, renderId?: string): string {
    const cfg = SecurityConfig.getInstance();
    if (!cfg.getFeatures().browserWatermark) {
      return "";
    }

    const ts = timestamp ?? new Date();

    const lines = [
      "EMQPGS — CONFIDENTIAL",
      ctx.userName,
      ctx.userEmail,
      ctx.userRole,
      ctx.sessionId,
      `Viewing: ${ts.toLocaleString()}`,
      `Doc: ${ctx.documentId}`,
    ];

    if (renderId) {
      lines.push(`Render: ${renderId}`);
    }

    // Build a repeating diagonal watermark
    const repeatCount = 6;
    const watermarkText = Array(repeatCount).fill(lines.join(" · ")).join("  ✦  ");

    return watermarkText;
  }

  /**
   * Get the CSS for the browser watermark overlay.
   */
  getBrowserWatermarkCSS(): string {
    const cfg = SecurityConfig.getInstance();
    if (!cfg.getFeatures().browserWatermark) {
      return "";
    }

    return `
.watermark-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
  user-select: none;
}
.watermark-overlay::before {
  content: attr(data-watermark);
  position: absolute;
  top: -100%;
  left: -100%;
  width: 300%;
  height: 300%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.06);
  font-family: monospace;
  white-space: pre;
  transform: rotate(-30deg);
  line-height: 3rem;
  pointer-events: none;
  user-select: none;
}`;
  }

  // ─── DOCX watermark ─────────────────────────────────────────────────────

  /**
   * Generate the DOCX watermark text for every page.
   * Returns empty string in development mode.
   *
   * @param renderTimestamp - Fresh timestamp for this render (defaults to ctx.timestamp).
   *                          Pass a distinct value per render to ensure different
   *                          output each time.
   */
  getDocxWatermarkText(ctx: WatermarkContext, renderTimestamp?: Date): string {
    const cfg = SecurityConfig.getInstance();
    if (!cfg.getFeatures().docxWatermark) {
      return "";
    }

    const ts = renderTimestamp ?? ctx.timestamp;

    return [
      "CONFIDENTIAL",
      `Downloaded By: ${ctx.userName}`,
      `Email: ${ctx.userEmail}`,
      `Role: ${ctx.userRole}`,
      `Timestamp: ${ts.toISOString()}`,
      `Document ID: ${ctx.documentId}`,
      `Download ID: ${ctx.downloadId}`,
    ].join("\n");
  }

  /**
   * Get the watermark text for the first page header/footer in DOCX.
   * Same as the main watermark but formatted for docx TextRun.
   */
  getDocxWatermarkLines(ctx: WatermarkContext, renderTimestamp?: Date): string[] {
    const cfg = SecurityConfig.getInstance();
    if (!cfg.getFeatures().docxWatermark) {
      return [];
    }

    const ts = renderTimestamp ?? ctx.timestamp;

    return [
      "CONFIDENTIAL",
      `Downloaded By: ${ctx.userName}`,
      `Email: ${ctx.userEmail}`,
      `Role: ${ctx.userRole}`,
      `Time: ${ts.toISOString()}`,
      `Doc ID: ${ctx.documentId}`,
      `Download ID: ${ctx.downloadId}`,
    ];
  }
}

/** Singleton accessor */
let watermarkServiceInstance: WatermarkService | null = null;
export function getWatermarkService(): WatermarkService {
  if (!watermarkServiceInstance) {
    watermarkServiceInstance = new WatermarkService();
  }
  return watermarkServiceInstance;
}
