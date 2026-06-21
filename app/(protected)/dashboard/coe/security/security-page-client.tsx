"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TypedConfirmModal } from "@/components/auth/typed-confirm-modal";
import { feedback } from "@/lib/feedback";
import { Shield, ShieldOff, Lock, Download, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";

interface SecurityPageClientProps {
  securityMode: string;
  chainIntact: boolean;
  downloadsEnabled: boolean;
  revealEnabled: boolean;
}

type ConfirmAction = {
  word: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
} | null;

export function SecurityPageClient({
  securityMode,
  chainIntact,
  downloadsEnabled,
  revealEnabled,
}: SecurityPageClientProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [checkingChain, setCheckingChain] = useState(false);
  const [chainResult, setChainResult] = useState<{
    status: "idle" | "checking" | "intact" | "broken";
    message: string;
  }>({ status: "idle", message: "" });

  const isProd = securityMode === "production";
  const isLockdown = securityMode === "lockdown";
  const isDev = securityMode === "development";

  // ─── Verify Audit Chain ───────────────────────────────────────────

  const handleVerifyChain = async () => {
    setCheckingChain(true);
    setChainResult({ status: "checking", message: "Verifying audit chain integrity..." });

    try {
      const res = await fetch("/api/audit-logs/verify");
      const json = await res.json();

      if (res.ok && json.success) {
        const breaks = json.data?.breaks ?? [];
        if (breaks.length === 0) {
          setChainResult({
            status: "intact",
            message: "Audit chain is intact — all hashes verified.",
          });
          feedback.success({ title: "Audit chain verified", description: "All hashes match." });
        } else {
          setChainResult({
            status: "broken",
            message: `${breaks.length} chain break${breaks.length !== 1 ? "s" : ""} detected. Investigate immediately.`,
          });
          feedback.error(`Audit chain compromised: ${breaks.length} break(s) found.`);
        }
      } else {
        setChainResult({
          status: "broken",
          message: json.error?.message ?? "Failed to verify audit chain.",
        });
        feedback.error("Could not verify audit chain.");
      }
    } catch {
      setChainResult({
        status: "broken",
        message: "Network error. Could not reach the server.",
      });
      feedback.error("Failed to connect to the server.");
    } finally {
      setCheckingChain(false);
    }
  };

  // ─── Lockdown Actions ─────────────────────────────────────────────

  const handleDisableDownloads = () => {
    setConfirmAction({
      word: "DISABLE",
      title: "Disable Downloads",
      description:
        "This will immediately block all paper downloads across the platform. Only COE users with step-up authentication can re-enable.",
      onConfirm: async () => {
        const res = await fetch("/api/security/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "DOWNLOADS_ENABLED", value: "false" }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? "Failed to disable downloads");
        }
        feedback.success({ title: "Downloads disabled", description: "All downloads have been blocked." });
      },
    });
  };

  const handleDisableReveal = () => {
    setConfirmAction({
      word: "DISABLE",
      title: "Disable Paper Reveal",
      description:
        "This will prevent all paper content from being revealed in the browser. Existing views will be closed.",
      onConfirm: async () => {
        const res = await fetch("/api/security/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "revealEnabled", value: "false" }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? "Failed to disable reveal");
        }
        feedback.success({ title: "Paper reveal disabled" });
      },
    });
  };

  const handleRevokeOtps = () => {
    setConfirmAction({
      word: "REVOKE",
      title: "Revoke All OTPs",
      description:
        "This will invalidate every active OTP code across the platform. All users will need to request new codes for step-up actions.",
      onConfirm: async () => {
        const res = await fetch("/api/security/otp/revoke-all", {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? "Failed to revoke OTPs");
        }
        feedback.success({ title: "All OTPs revoked", description: "Active OTP codes invalidated." });
      },
    });
  };

  const handleActivateLockdown = () => {
    setConfirmAction({
      word: "OVERRIDE",
      title: "Activate Lockdown Mode",
      description:
        "Lockdown mode disables all downloads, paper reveals, and forces re-authentication for all users. This is an emergency measure.",
      onConfirm: async () => {
        const res = await fetch("/api/security/config/mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "lockdown" }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? "Failed to activate lockdown");
        }
        feedback.success({ title: "Lockdown activated" });
      },
    });
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Actions Section */}
      <Card>
        <CardHeader>
          <CardTitle>Security Actions</CardTitle>
          <CardDescription>Operational controls and diagnostics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Verify Audit Chain */}
          <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Audit Chain Verification</p>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                {chainResult.status === "idle"
                  ? chainIntact
                    ? "Last check: chain intact"
                    : "Chain integrity has known breaks — verify now"
                  : chainResult.message}
              </p>
            </div>
            <Button
              variant={chainIntact ? "outline" : "danger"}
              onClick={handleVerifyChain}
              loading={checkingChain}
            >
              {checkingChain ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Chain"
              )}
            </Button>
          </div>

          {/* Toggle Security Mode — COE only */}
          {!isLockdown && (
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Security Mode</p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  {isProd
                    ? "Currently in Production mode — full security enforcement"
                    : "Currently in Development mode — security verifications bypassed"}
                </p>
              </div>
              <Button
                variant={isProd ? "outline" : "default"}
                onClick={() => {
                  setConfirmAction({
                    word: "TOGGLE",
                    title: `Switch to ${isProd ? "Development" : "Production"} Mode`,
                    description: isProd
                      ? "Switching to development mode will bypass OTP, step-up, and watermark verification. Only use in controlled environments."
                      : "Switching to production mode enforces full security: OTP, typed confirmation, watermarks, and step-up auth.",
                    onConfirm: async () => {
                      const newMode = isProd ? "development" : "production";
                      const res = await fetch("/api/security/config/mode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mode: newMode }),
                      });
                      const json = await res.json();
                      if (!res.ok || !json.success) {
                        throw new Error(json.error?.message ?? "Failed to toggle mode");
                      }
                      feedback.success({
                        title: `Mode switched to ${newMode}`,
                        description: "Refresh the page to see changes.",
                      });
                    },
                  });
                }}
              >
                {isProd ? (
                  <>
                    <ShieldOff className="h-4 w-4" />
                    Switch to Dev
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Switch to Production
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lockdown Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--danger)]" />
            <CardTitle>Lockdown Controls</CardTitle>
            {isLockdown && <Badge variant="danger">Active</Badge>}
          </div>
          <CardDescription>
            Emergency controls for immediate threat response. All actions require typed confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLockdown && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Lockdown is active</p>
                <p className="mt-0.5 text-amber-700">
                  Downloads and paper reveals are disabled. All users require re-authentication.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant={isLockdown ? "default" : "secondary"}
              size="sm"
              onClick={handleDisableDownloads}
              disabled={!downloadsEnabled}
              title={!downloadsEnabled ? "Downloads already disabled" : undefined}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Disable Downloads
            </Button>
            <Button
              variant={isLockdown ? "default" : "secondary"}
              size="sm"
              onClick={handleDisableReveal}
              disabled={!revealEnabled}
              title={!revealEnabled ? "Reveal already disabled" : undefined}
            >
              <EyeOff className="mr-1.5 h-4 w-4" />
              Disable Reveal
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRevokeOtps}
            >
              <KeyRound className="mr-1.5 h-4 w-4" />
              Revoke All OTPs
            </Button>
            {!isLockdown && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleActivateLockdown}
              >
                <Lock className="mr-1.5 h-4 w-4" />
                Activate Lockdown
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Typed Confirmation Modal */}
      {confirmAction && (
        <TypedConfirmModal
          action={confirmAction.word}
          title={confirmAction.title}
          description={confirmAction.description}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}

function KeyRound(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}
