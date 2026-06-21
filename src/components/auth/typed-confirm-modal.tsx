"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle, Loader2, Eye, Download, Archive, Check } from "lucide-react";

const actionIcons: Record<string, React.ElementType> = {
  REVEAL: Eye,
  DOWNLOAD: Download,
  USED: Check,
  ARCHIVE: Archive,
};

interface TypedConfirmModalProps {
  action: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  requireStepUp?: boolean;
  isLoading?: boolean;
}

type Step = "otp" | "confirm" | "success" | "error";

export function TypedConfirmModal({
  action,
  title,
  description,
  onConfirm,
  onCancel,
  requireStepUp = false,
  isLoading: externalLoading,
}: TypedConfirmModalProps) {
  const [step, setStep] = useState<Step>(requireStepUp ? "otp" : "confirm");
  const [typedWord, setTypedWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRef = useRef<HTMLInputElement>(null);

  const loading = externalLoading || internalLoading;
  const ActionIcon = actionIcons[action] ?? Eye;
  const match = typedWord === action;
  const partialMatch =
    typedWord.length > 0 && typedWord.length <= action.length && action.startsWith(typedWord);
  const isWrong = typedWord.length > 0 && !partialMatch;

  useEffect(() => {
    if (step === "confirm") {
      inputRef.current?.focus();
    }
  }, [step]);

  const handleConfirm = useCallback(async () => {
    if (!match) return;
    setInternalLoading(true);
    setError(null);
    try {
      await onConfirm();
      setStep("success");
      setTimeout(() => onCancel(), 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Please try again.");
      setStep("error");
    } finally {
      setInternalLoading(false);
    }
  }, [match, onConfirm, onCancel]);

  const handleOtpComplete = useCallback((code: string) => {
    // OTP verified externally — move to confirm step
    setStep("confirm");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && match && !loading) {
        handleConfirm();
      }
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    },
    [match, loading, handleConfirm, onCancel],
  );

  // ─── OTP Step ────────────────────────────────────────────────────────

  if (step === "otp") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={loading ? undefined : onCancel}
      >
        <div
          className="w-full max-w-sm rounded-xl bg-[var(--card)] p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-hover)]">
              <ActionIcon className="h-5 w-5 text-[var(--text-primary)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Step-Up Authentication
              </h3>
              <p className="text-sm text-[var(--text-tertiary)]">
                Verify your identity to {action.toLowerCase()}
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            A one-time code has been sent to your registered email. Enter it below to proceed.
          </p>

          <OtpInput value={otp} onChange={setOtp} onComplete={handleOtpComplete} disabled={loading} />

          {error && (
            <div className="mt-3 flex items-start gap-2 text-sm text-[var(--danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={() => handleOtpComplete(otp.join(""))} loading={loading}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Success Step ────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl bg-[var(--card)] p-8 shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {title} completed
          </p>
        </div>
      </div>
    );
  }

  // ─── Confirm Step ────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-[var(--card)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              step === "error"
                ? "bg-red-50"
                : "bg-[var(--surface-hover)]",
            )}
          >
            {step === "error" ? (
              <AlertCircle className="h-5 w-5 text-[var(--danger)]" />
            ) : (
              <ActionIcon className="h-5 w-5 text-[var(--text-primary)]" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-sm text-[var(--text-tertiary)]">{description}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            Type <span className="font-mono font-bold text-[var(--text-primary)]">{action}</span> to confirm
          </label>
          <input
            ref={inputRef}
            value={typedWord}
            onChange={(e) => setTypedWord(e.target.value.toUpperCase())}
            placeholder={`Type "${action}" here...`}
            disabled={loading}
            className={cn(
              "flex h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-150 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 font-mono text-base uppercase tracking-widest",
              partialMatch && "border-green-500 ring-1 ring-green-500",
              isWrong && "border-[var(--danger)] ring-1 ring-[var(--danger)]",
            )}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text").toUpperCase().trim();
              setTypedWord(pasted.slice(0, action.length));
            }}
          />
          {isWrong && (
            <div className="flex items-start gap-2 text-xs text-[var(--danger)]">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>Does not match &quot;{action}&quot;</span>
            </div>
          )}
          {partialMatch && typedWord.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                {action.split("").map((char, i) => {
                  const typed = typedWord[i];
                  const isCorrect = typed === char;
                  const isPending = typed == null;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex h-5 w-4 items-center justify-center rounded text-[10px] font-mono font-bold transition-colors",
                        isCorrect && "bg-green-100 text-green-700",
                        isPending && "bg-[var(--surface-hover)] text-[var(--text-muted)]",
                      )}
                    >
                      {isCorrect ? char : isPending ? "" : typed}
                    </span>
                  );
                })}
              </div>
              {typedWord.length === action.length && (
                <Check className="ml-1 h-3 w-3 text-green-600" />
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-[var(--danger)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!match || loading} loading={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Confirm ${action}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── OTP Input Sub-Component ─────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string[];
  onChange: (digits: string[]) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return;
    const next = [...value];
    next[index] = digit.slice(-1);
    onChange(next);

    const code = next.join("");
    if (code.length === 6 && code.split("").every((d) => d !== "")) {
      onComplete(code);
    }

    // Auto-advance
    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;
    const next = [...value];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    onChange(next);
    const code = next.join("");
    if (code.length === 6 && code.split("").every((d) => d !== "")) {
      onComplete(code);
    }
    // Focus next empty or last
    const focusIndex = Math.min(pasted.length, 5);
    refs.current[focusIndex]?.focus();
  };

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "flex h-12 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-center text-lg font-mono font-bold text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
            disabled && "opacity-50",
            digit && "border-[var(--accent)]",
          )}
        />
      ))}
    </div>
  );
}
