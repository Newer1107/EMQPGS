import { SecurityConfig, getSecurityModeLabel, SecurityMode } from "@/lib/auth/security-config";
import { getAuditService } from "@/lib/auth/audit-service";
import { AnomalyDetectionService } from "@/lib/auth/anomaly-detection";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { AlertCircle, AlertTriangle, CheckCircle2, Shield, ShieldOff, Lock, Download, KeyRound, Fingerprint, type LucideIcon } from "lucide-react";
import { SecurityPageClient } from "./security-page-client";

const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

export default async function SecurityDashboardPage() {
  const audit = getAuditService();

  const [failedOtps, downloads, chainResult, recentEvents, anomalies] = await Promise.all([
    audit.getFailedOtpCount(twentyFourHoursAgo),
    audit.getDownloadCount(twentyFourHoursAgo),
    audit.verifyChain(),
    audit.getRecentEvents(50),
    new AnomalyDetectionService().runAll(),
  ]);

  const cfg = SecurityConfig.getInstance();
  const mode = cfg.mode;
  const modeLabel = getSecurityModeLabel(mode);
  const features = cfg.getFeatures();

  const modeBadge = {
    variant: mode === SecurityMode.PRODUCTION ? "success" as const : mode === SecurityMode.LOCKDOWN ? "danger" as const : "warning" as const,
    icon: mode === SecurityMode.PRODUCTION ? Shield : mode === SecurityMode.LOCKDOWN ? Lock : ShieldOff,
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Security Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Operational security monitoring and controls
          </p>
        </div>
        <Badge variant={modeBadge.variant} className="flex items-center gap-1.5 py-1 pl-2 pr-3">
          <modeBadge.icon className="h-3.5 w-3.5" />
          {modeLabel}
        </Badge>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          value={failedOtps}
          label="Failed OTPs (24h)"
          icon={<KeyRound className="h-4 w-4" />}
          variant={failedOtps > 10 ? "warning" : "default"}
        />
        <StatCard
          value={downloads}
          label="Downloads (24h)"
          icon={<Download className="h-4 w-4" />}
          variant={downloads > 50 ? "info" : "default"}
        />
        <StatCard
          value={features.otpRequired ? "Enabled" : "Bypassed"}
          label="Step-Up Auth"
          icon={<Fingerprint className="h-4 w-4" />}
          variant={features.otpRequired ? "info" : "warning"}
        />
        <StatCard
          value={chainResult.length === 0 ? "Intact" : `${chainResult.length} break${chainResult.length !== 1 ? "s" : ""}`}
          label="Audit Chain"
          icon={chainResult.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          variant={chainResult.length === 0 ? "success" : "danger"}
          detail={chainResult.length > 0 ? "Chain integrity compromised" : undefined}
        />
      </div>

      {/* ── Chain Breaks Alert ────────────────────────────────────── */}
      {chainResult.length > 0 && (
        <Card variant="dense">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]" />
            <div>
              <p className="text-sm font-medium text-[var(--danger)]">
                Audit chain integrity check failed
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {chainResult.length} break{chainResult.length !== 1 ? "s" : ""} detected. Review the audit log
                immediately. The chain may have been tampered with or a hash mismatch occurred.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Anomaly Alerts ─────────────────────────────────────────── */}
      {anomalies.length > 0 && (
        <Card variant="dense">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--warning)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {anomalies.length} suspicious pattern{anomalies.length !== 1 ? "s" : ""} detected
              </p>
            </div>
            {anomalies.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3">
                <SeverityBadge severity={a.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{a.description}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                    {a.count} events in last {a.timeWindowMinutes} min (threshold: {a.threshold})
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Recent Security Events ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
          <CardDescription>Last {recentEvents.length} events from the audit log</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Action</TH>
                <TH>Actor</TH>
                <TH>Resource</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {recentEvents.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-sm text-[var(--text-tertiary)]">
                    No security events recorded yet
                  </TD>
                </TR>
              ) : (
                recentEvents.map((event) => (
                  <TR key={event.id}>
                    <TD className="whitespace-nowrap text-xs text-[var(--text-secondary)]">
                      {formatTimestamp(event.createdAt)}
                    </TD>
                    <TD className="font-mono text-xs">{formatAction(event.action)}</TD>
                    <TD>
                      {event.actor ? (
                        <span className="text-sm text-[var(--text-primary)]">{event.actor.name}</span>
                      ) : (
                        <span className="text-xs text-[var(--text-tertiary)]">System</span>
                      )}
                    </TD>
                    <TD className="max-w-[200px] truncate text-xs text-[var(--text-secondary)]">
                      {event.ipAddress ?? "—"}
                    </TD>
                    <TD>
                      <StatusBadge action={event.action} />
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Actions & Lockdown Section (Client) ───────────────────── */}
      <SecurityPageClient
        securityMode={mode}
        chainIntact={chainResult.length === 0}
        downloadsEnabled={features.downloadsEnabled}
        revealEnabled={features.paperRevealEnabled}
      />
    </div>
  );
}

// ─── Server-safe Sub-Components ───────────────────────────────────────

function StatCard({
  value,
  label,
  icon,
  variant = "default",
  detail,
}: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "danger";
  detail?: string;
}) {
  const borderColors: Record<string, string> = {
    default: "",
    success: "border-l-green-500",
    warning: "border-l-amber-500",
    info: "border-l-blue-500",
    danger: "border-l-red-500",
  };

  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 ${borderColors[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            {label}
          </div>
          {detail && (
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</div>
          )}
        </div>
        <div className="shrink-0 text-[var(--text-tertiary)]">{icon}</div>
      </div>
    </div>
  );
}

function StatusBadge({ action }: { action: string }) {
  if (action.includes("FAILED") || action.includes("ERROR") || action.includes("BREAK")) {
    return <Badge variant="danger">Failed</Badge>;
  }
  if (action.includes("VERIFIED") || action.includes("APPROVED") || action.includes("DOWNLOADED")) {
    return <Badge variant="success">Success</Badge>;
  }
  if (action.includes("REQUESTED") || action.includes("CREATED")) {
    return <Badge variant="info">Pending</Badge>;
  }
  return <Badge variant="default">{action.includes("_") ? action.split("_").pop() : action}</Badge>;
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    LOW: "bg-blue-100 text-blue-800",
    MEDIUM: "bg-amber-100 text-amber-800",
    HIGH: "bg-orange-100 text-orange-800",
    CRITICAL: "bg-red-100 text-red-800",
  };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[severity] ?? "bg-gray-100 text-gray-800"}`}>
      {severity}
    </span>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
