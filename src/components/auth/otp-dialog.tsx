"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw, CheckCircle2, Clock, Mail } from "lucide-react";

type OtpState =
  | { phase: "requesting" }
  | { phase: "input" }
  | { phase: "verifying" }
  | { phase: "error"; attemptsRemaining: number; message: string }
  | { phase: "rate_limited" }
  | { phase: "expired" }
  | { phase: "success" };

interface OtpDialogProps {
  purpose: string;
  email: string;
  onVerified: () => void;
  onCancel: () => void;
}

/** Mask email for display: "j***@example.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

export function OtpDialog({ purpose, email, onVerified, onCancel }: OtpDialogProps) {
  const [state, setState] = useState<OtpState>({ phase: "requesting" });
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Simulate initial OTP request
  useEffect(() => {
    const timer = setTimeout(() => {
      setState({ phase: "input" });
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const maskedEmail = maskEmail(email);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (state.phase !== "input") return;
      if (!/^\d*$/.test(value)) return;

      const next = [...digits];
      next[index] = value.slice(-1);
      setDigits(next);

      // Auto-submit when all 6 digits entered
      const code = next.join("");
      if (code.length === 6 && code.split("").every((d) => d !== "")) {
        verifyCode(code);
        return;
      }

      // Auto-advance
      if (value && index < 5) {
        refs.current[index + 1]?.focus();
      }
    },
    [state.phase, digits],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (!digits[index] && index > 0) {
          const next = [...digits];
          next[index - 1] = "";
          setDigits(next);
          refs.current[index - 1]?.focus();
        } else if (digits[index]) {
          const next = [...digits];
          next[index] = "";
          setDigits(next);
        }
      }
      if (e.key === "ArrowLeft" && index > 0) {
        refs.current[index - 1]?.focus();
      }
      if (e.key === "ArrowRight" && index < 5) {
        refs.current[index + 1]?.focus();
      }
      if (e.key === "Tab" && !e.shiftKey && index < 5) {
        e.preventDefault();
        refs.current[index + 1]?.focus();
      }
      if (e.key === "Tab" && e.shiftKey && index > 0) {
        e.preventDefault();
        refs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (state.phase !== "input") return;
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pasted.length === 0) return;

      const next = [...digits];
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i];
      }
      setDigits(next);

      // Focus next empty or last
      const focusIndex = Math.min(pasted.length, 5);
      refs.current[focusIndex]?.focus();

      // Auto-submit
      if (pasted.length === 6) {
        verifyCode(pasted);
      }
    },
    [state.phase, digits],
  );

  const verifyCode = useCallback(async (code: string) => {
    setState({ phase: "verifying" });

    // Simulate verification — in real usage this calls an API
    // This is a placeholder that always succeeds after 1.5s
    // The actual implementation should call the OTP verify endpoint
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Placeholder: treat any 6-digit code as valid
    // Replace this with actual API call
    setState({ phase: "success" });
    setTimeout(() => onVerified(), 600);
  }, [onVerified]);

  const handleRetry = useCallback(() => {
    setDigits(["", "", "", "", "", ""]);
    setState({ phase: "requesting" });
    setTimeout(() => setState({ phase: "input" }), 1000);
  }, []);

  const handleRequestNew = useCallback(() => {
    setDigits(["", "", "", "", "", ""]);
    setState({ phase: "requesting" });
    setTimeout(() => setState({ phase: "input" }), 1000);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────

  const showShake = state.phase === "error" || state.phase === "rate_limited";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={state.phase === "verifying" ? undefined : onCancel}
    >
      <div
        className={cn(
          "w-full max-w-sm rounded-xl bg-[var(--card)] p-6 shadow-lg",
          showShake && "animate-shake",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-hover)]">
            <Mail className="h-5 w-5 text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Verify to {purpose}
            </h3>
            <p className="text-sm text-[var(--text-tertiary)]">
              A code was sent to {maskedEmail}
            </p>
          </div>
        </div>

        {/* State: Requesting */}
        {state.phase === "requesting" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">Sending OTP to {maskedEmail}...</p>
          </div>
        )}

        {/* State: Input */}
        {state.phase === "input" && (
          <>
            <p className="mb-4 text-center text-sm text-[var(--text-secondary)]">
              Enter the 6-digit code sent to <span className="font-medium text-[var(--text-primary)]">{maskedEmail}</span>
            </p>

            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  aria-label={`Digit ${i + 1}`}
                  className={cn(
                    "flex h-12 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-center text-lg font-mono font-bold text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
                    digit && "border-[var(--accent)] bg-[var(--surface-hover)]",
                  )}
                />
              ))}
            </div>

            <p className="mt-3 text-center text-xs text-[var(--text-tertiary)]">
              Code expires in 5 minutes
            </p>
          </>
        )}

        {/* State: Verifying */}
        {state.phase === "verifying" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-secondary)]">Verifying code...</p>
          </div>
        )}

        {/* State: Error */}
        {state.phase === "error" && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              <div>
                <p className="font-medium text-[var(--danger)]">{state.message}</p>
                <p className="mt-0.5 text-[var(--text-tertiary)]">
                  {state.attemptsRemaining} attempt{state.attemptsRemaining !== 1 ? "s" : ""} remaining
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleRetry}>
                Try Again
              </Button>
              <Button variant="ghost" className="flex-1" onClick={handleRequestNew}>
                Request New Code
              </Button>
            </div>
          </div>
        )}

        {/* State: Rate Limited */}
        {state.phase === "rate_limited" && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg bg-orange-50 p-3 text-sm">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
              <div>
                <p className="font-medium text-orange-700">Too many attempts</p>
                <p className="mt-0.5 text-[var(--text-tertiary)]">
                  Request a new code to try again.
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleRequestNew}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Request New Code
            </Button>
          </div>
        )}

        {/* State: Expired */}
        {state.phase === "expired" && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
              <div>
                <p className="font-medium text-[var(--text-primary)]">Code expired</p>
                <p className="mt-0.5 text-[var(--text-tertiary)]">
                  The verification code has expired. Request a new one.
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleRequestNew}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Request New Code
            </Button>
          </div>
        )}

        {/* State: Success */}
        {state.phase === "success" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Verified successfully</p>
          </div>
        )}

        {/* Footer actions */}
        {state.phase === "input" && (
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <p className="text-xs text-[var(--text-tertiary)]">
              Didn&apos;t receive it?{" "}
              <button
                onClick={handleRequestNew}
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Resend
              </button>
            </p>
          </div>
        )}

        {state.phase === "error" && (
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
