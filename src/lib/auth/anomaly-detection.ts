import { prisma } from "@/lib/db";
import { SECURITY_ACTIONS } from "@/lib/constants";
import crypto from "node:crypto";

export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AnomalyEvent = {
  id: string;
  severity: AnomalySeverity;
  type: string;
  actorId?: string;
  description: string;
  count: number;
  threshold: number;
  timeWindowMinutes: number;
  detectedAt: Date;
};

export class AnomalyDetectionService {
  private async detect(
    type: string,
    severity: AnomalySeverity,
    action: string,
    threshold: number,
    windowMinutes: number,
  ): Promise<AnomalyEvent[]> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const groups = await prisma.auditLog.groupBy({
      by: ["actorId"],
      where: {
        action,
        createdAt: { gte: since },
        actorId: { not: null },
      },
      _count: { id: true },
    });

    return groups
      .filter((g) => g._count.id > threshold)
      .map((g) => ({
        id: crypto.randomUUID(),
        severity,
        type,
        actorId: g.actorId!,
        description: `${action}: ${g._count.id} occurrences in ${windowMinutes} min (threshold: ${threshold})`,
        count: g._count.id,
        threshold,
        timeWindowMinutes: windowMinutes,
        detectedAt: new Date(),
      }));
  }

  async detectExcessiveOtpFailures(threshold = 10, windowMinutes = 15): Promise<AnomalyEvent[]> {
    return this.detect("EXCESSIVE_OTP_FAILURES", "HIGH", SECURITY_ACTIONS.OTP_FAILED, threshold, windowMinutes);
  }

  async detectHighDownloadCount(threshold = 20, windowMinutes = 60): Promise<AnomalyEvent[]> {
    return this.detect("HIGH_DOWNLOAD_COUNT", "MEDIUM", SECURITY_ACTIONS.PAPER_DOWNLOADED, threshold, windowMinutes);
  }

  async detectRepeatedRegeneration(threshold = 3, windowMinutes = 30): Promise<AnomalyEvent[]> {
    return this.detect("REPEATED_REGENERATION", "MEDIUM", SECURITY_ACTIONS.PAPER_REGENERATED, threshold, windowMinutes);
  }

  async detectOffHoursActivity(workingHourStart = 8, workingHourEnd = 20): Promise<AnomalyEvent[]> {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= workingHourStart && hour < workingHourEnd) return [];

    // Check for any security-sensitive actions in the last hour outside working hours
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const groups = await prisma.auditLog.groupBy({
      by: ["actorId", "action"],
      where: {
        actorId: { not: null },
        createdAt: { gte: since },
        action: {
          in: [
            SECURITY_ACTIONS.PAPER_DOWNLOADED,
            SECURITY_ACTIONS.PAPER_REVEALED,
            SECURITY_ACTIONS.OTP_VERIFIED,
            SECURITY_ACTIONS.OTP_FAILED,
            SECURITY_ACTIONS.PAPER_MARKED_USED,
            SECURITY_ACTIONS.PAPER_REGENERATED,
          ],
        },
      },
      _count: { id: true },
    });

    return groups.map((g) => ({
      id: crypto.randomUUID(),
      severity: "LOW" as AnomalySeverity,
      type: "OFF_HOURS_ACTIVITY",
      actorId: g.actorId!,
      description: `${g.action} at ${now.toLocaleTimeString()} (working hours: ${workingHourStart}:00-${workingHourEnd}:00)`,
      count: g._count.id,
      threshold: 1,
      timeWindowMinutes: 60,
      detectedAt: now,
    }));
  }

  async detectRapidDownloads(threshold = 5, windowMinutes = 10): Promise<AnomalyEvent[]> {
    return this.detect("RAPID_DOWNLOADS", "HIGH", SECURITY_ACTIONS.PAPER_DOWNLOADED, threshold, windowMinutes);
  }

  async runAll(): Promise<AnomalyEvent[]> {
    const results = await Promise.all([
      this.detectExcessiveOtpFailures(),
      this.detectHighDownloadCount(),
      this.detectRepeatedRegeneration(),
      this.detectOffHoursActivity(),
      this.detectRapidDownloads(),
    ]);
    return results.flat();
  }
}
