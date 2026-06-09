"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className="page-kicker">Recovery</p>
          <CardTitle className="mt-2 text-5xl">Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            action={async (formData) => {
              const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token: formData.get("token"),
                  password: formData.get("password"),
                }),
              });
              const result = await response.json();
              setMessage(result.data?.message ?? result.error?.message ?? "Completed");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="token">Reset token</Label>
              <Input id="token" name="token" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" />
            </div>
            <div className="editorial-rule flex items-center justify-between pt-6">
              <Button type="submit">Reset Password</Button>
              <p className="max-w-sm text-right text-sm italic text-[var(--muted-foreground)]">{message}</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
