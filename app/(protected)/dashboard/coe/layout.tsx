import { Role } from "@prisma/client";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { redirect } from "next/navigation";

export default async function CoELayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserFromCookies();

  if (user.role !== Role.COE) {
    redirect("/dashboard");
  }

  return children;
}

