import { getCurrentUserFromCookies } from "@/lib/api-context";
import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let role: string | null = null;
  let name: string | null = null;
  let email: string | null = null;
  try {
    const user = await getCurrentUserFromCookies();
    role = user.role;
    name = user.name;
    email = user.email;
  } catch {
    redirect("/login");
  }

  return <AppShell role={role!} userName={name!} userEmail={email!}>{children}</AppShell>;
}
