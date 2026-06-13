import { Role } from "@prisma/client";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { redirect } from "next/navigation";

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserFromCookies();

  if (user.role !== Role.MODERATOR) {
    redirect("/dashboard");
  }

  return children;
}
