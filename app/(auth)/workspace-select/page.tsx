import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { WorkspacePicker } from "@/components/workspace/workspace-picker";

export default async function WorkspaceSelectPage() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const responsibilities = await resolver.resolve(actor.id);

  return (
    <WorkspacePicker
      responsibilities={responsibilities.map((r) => ({
        id: r.id,
        type: r.type,
        scopeType: r.scopeType,
        scopeId: r.scopeId,
      }))}
      userName={actor.name}
    />
  );
}
