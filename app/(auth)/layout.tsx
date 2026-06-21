import { getCurrentUserFromCookies } from "@/lib/api-context";
import { redirect } from "next/navigation";

/**
 * Auth-required layout that does NOT render AppShell.
 * Used for pre-workspace pages: workspace selection, no-access.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  try {
    await getCurrentUserFromCookies();
  } catch {
    redirect("/login");
  }

  return <>{children}</>;
}
