import { SecurityConfig } from "@/lib/auth/security-config";
import { ShieldOff } from "lucide-react";

/**
 * Development Security Banner — shown at the top of every protected page
 * when SECURITY_MODE=development.
 *
 * Server component. Renders nothing in production / lockdown.
 * Not dismissible — intentionally impossible to miss.
 */
export function DevSecurityBanner() {
  const cfg = SecurityConfig.getInstance();
  if (cfg.mode !== "development") {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-bold text-amber-950"
      style={{
        background: "#FFB300",
        zIndex: 10000,
        position: "sticky",
        top: 0,
        width: "100%",
      }}
    >
      <ShieldOff className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>
        ⚠ DEVELOPMENT SECURITY MODE — OTP bypass enabled — Watermarks disabled —
        Not suitable for production
      </span>
    </div>
  );
}
