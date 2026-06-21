import { redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { ActiveWorkspaceService } from "@/lib/auth/active-workspace";

export default async function DashboardIndexPage() {
  const user = await getCurrentUserFromCookies();
  const aws = new ActiveWorkspaceService();
  const active = await aws.resolve(user.id);
  if (active) {
    redirect(`/dashboard/${active.responsibility.toLowerCase()}`);
  }

  const resolver = new ResponsibilityResolver();
  const responsibilities = await resolver.resolve(user.id);

  if (responsibilities.length === 0) redirect("/no-access");
  if (responsibilities.length === 1) {
    redirect(`/api/auth/workspace?assignmentId=${responsibilities[0].id}`);
  }
  redirect("/workspace-select");
}