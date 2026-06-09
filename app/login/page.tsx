"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(formData: FormData) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    const result = await response.json();
    if (!result.success) {
      setError(result.error?.message ?? "Login failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative overflow-hidden border-b-2 border-[var(--foreground)] px-6 py-10 lg:border-b-0 lg:border-r-2 lg:px-10 lg:py-14">
        <div className="editorial-rule-heavy max-w-5xl pt-10">
          <p className="page-kicker">Examination Management</p>
          <h1 className="page-display mt-6 max-w-4xl">MONOCHROME CONTROL</h1>
          <p className="page-lead mt-8">
            A disciplined operational system for examination governance, question contribution, moderation, and audit-ready academic workflows.
          </p>
        </div>
        <div className="mt-12 max-w-3xl border-y-2 border-[var(--foreground)] py-8">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["126", "question coordinates per bank"],
              ["5", "institutional roles aligned"],
              ["0", "accent colors, by design"],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">{label}</p>
                <p className="mt-3 text-6xl leading-none tracking-tight">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-10 lg:px-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <p className="page-kicker">Secure Access</p>
            <CardTitle className="mt-2 text-5xl">Sign In</CardTitle>
            <CardDescription>Access the editorial-grade EMQPGS control surface with your institutional credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" action={async (formData) => onSubmit(formData)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue="coe@emqpgs.local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" defaultValue="Password@123" />
              </div>
              <p className="text-sm italic text-black">{error}</p>
              <div className="editorial-rule flex items-center justify-between pt-6">
                <Button className="min-w-40" type="submit">
                  Enter System
                </Button>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">JWT Sessions</span>
              </div>
            </form>
            <div className="mt-8 flex justify-between text-sm">
              <a href="/forgot-password" className="border-b border-transparent pb-1 text-[var(--muted-foreground)] transition-all duration-100 hover:border-[var(--foreground)] hover:text-[var(--foreground)]">
                Forgot password
              </a>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Refresh Tokens</span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
