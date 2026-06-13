import { Role } from "@prisma/client";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { redirect } from "next/navigation";

export default async function ContributorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserFromCookies();

  if (user.role !== Role.CONTRIBUTOR) {
    redirect("/dashboard");
  }

  return children;
}
