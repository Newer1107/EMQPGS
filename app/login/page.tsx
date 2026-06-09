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
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to EMQPGS with your institutional account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action={async (formData) => onSubmit(formData)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue="coe@emqpgs.local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" defaultValue="Password@123" />
            </div>
            <p className="text-sm text-rose-600">{error}</p>
            <Button className="w-full" type="submit">
              Login
            </Button>
          </form>
          <div className="mt-4 flex justify-between text-sm">
            <a href="/forgot-password" className="text-slate-600 hover:text-slate-950">
              Forgot password?
            </a>
            <span className="text-slate-400">JWT + Refresh Tokens</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
