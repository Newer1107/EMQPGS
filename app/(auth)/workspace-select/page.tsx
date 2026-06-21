import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { WorkspaceDisplayResolver } from "@/lib/auth/workspace-display";
import { WorkspacePicker } from "@/components/workspace/workspace-picker";

export default async function WorkspaceSelectPage() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const displayResolver = new WorkspaceDisplayResolver();
  const responsibilities = await resolver.resolve(actor.id);
  const resolved = await Promise.all(
    responsibilities.map(async (r) => ({
      id: r.id,
      display: await displayResolver.resolve(r.type, r.scopeType, r.scopeId),
    })),
  );

  return <WorkspacePicker responsibilities={resolved} userName={actor.name} />;
}
