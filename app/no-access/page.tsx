import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">No Access</h1>
        <p className="text-sm text-neutral-500">
          You don&apos;t have any responsibilities assigned. Contact your system administrator to get access.
        </p>
        <Link href="/login">
          <Button variant="outline">Return to Login</Button>
        </Link>
      </div>
    </div>
  );
}
