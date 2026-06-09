"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className="page-kicker">Recovery</p>
          <CardTitle className="mt-2 text-5xl">Forgot Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            action={async (formData) => {
              const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: formData.get("email") }),
              });
              const result = await response.json();
              setMessage(result.data?.debugToken ? `Dev token: ${result.data.debugToken}` : result.data?.message ?? "Done");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="editorial-rule flex items-center justify-between pt-6">
              <Button type="submit">Generate Reset Link</Button>
              <p className="max-w-sm text-right text-sm italic text-[var(--muted-foreground)]">{message}</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
