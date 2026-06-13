import { Role } from "@prisma/client";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { redirect } from "next/navigation";

export default async function DeanLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserFromCookies();

  if (user.role !== Role.DEAN) {
    redirect("/dashboard");
  }

  return children;
}
