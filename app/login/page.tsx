"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client-fetch";
import { APP_NAME, responsibilityLabels } from "@/lib/constants";

const ROLES = [
  { key: "COE", label: responsibilityLabels.COE, desc: "System governance & oversight" },
  { key: "COORDINATOR", label: responsibilityLabels.COORDINATOR, desc: "Workflow & bank management" },
  { key: "CONTRIBUTOR", label: responsibilityLabels.CONTRIBUTOR, desc: "Question creation" },
  { key: "MODERATOR", label: responsibilityLabels.MODERATOR, desc: "Quality assurance" },
  { key: "DEAN", label: responsibilityLabels.DEAN, desc: "Final paper review" },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    const result = await response.json();
    setLoading(false);

    if (!result.success) {
      setError(result.error?.message ?? "Sign in failed. Please check your email and password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:flex lg:w-[45%] xl:w-[42%] flex-col justify-between bg-neutral-950 p-12 xl:p-16 text-white">
        <div className="space-y-10">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center border border-white/20 rounded-lg">
                <span className="text-lg font-bold tracking-widest font-[var(--font-display)]">EM</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white/60">Institutional Platform</p>
              </div>
            </div>

            <h1 className="text-3xl xl:text-4xl font-[var(--font-display)] tracking-tight leading-tight">
              {APP_NAME}
            </h1>
            <p className="mt-3 text-base text-white/60 leading-relaxed max-w-md">
              Examination Management &amp; Question Paper Generation System
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-white/40 uppercase tracking-widest text-xs font-medium">
              System Overview
            </p>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              A role-governed platform for end-to-end examination lifecycle management — from
              question bank creation through moderation, approval, paper generation, and secure export.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Roles</p>
            <div className="space-y-2">
              {ROLES.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/30 shrink-0" />
                  <span className="text-white/80 font-medium min-w-[7rem]">{label}</span>
                  <span className="text-white/40 text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10">
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span>Secure platform</span>
            <span className="h-3 w-px bg-white/10" />
            <span>Role-based access</span>
            <span className="h-3 w-px bg-white/10" />
            <span>Audit trail</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-neutral-500">Sign in to your account to continue.</p>
          </div>

          <Card className="border-neutral-200 shadow-sm">
            <CardContent className="p-6">
              <form className="space-y-5" action={async (formData) => onSubmit(formData)} aria-busy={loading} aria-describedby={error ? "login-error" : undefined}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="you@institution.edu" required />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-neutral-500 hover:text-neutral-900 hover:underline transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input id="password" name="password" type="password" placeholder="Enter your password" required />
                </div>

                {error && (
                  <div id="login-error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                    {error}
                  </div>
                )}

                <Button className="w-full h-11" type="submit" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="8" />
                      </svg>
                      Signing in&hellip;
                    </span>
                  ) : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex lg:hidden mt-8 pt-6 border-t border-neutral-100">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
              <span>Secure platform</span>
              <span>Role-based access</span>
              <span>Audit trail</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
