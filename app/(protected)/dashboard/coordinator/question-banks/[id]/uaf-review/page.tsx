import Link from "next/link";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { UafReviewService } from "@/modules/uaf-review/service";
import { UafReviewWorkspace } from "@/components/uaf-review/review-workspace";

export default async function UafReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUserFromCookies();
  const auth = await new ResponsibilityResolver().resolveAsContext(user.id, user);
  const data = await new UafReviewService().get(auth, id);
  return <main className="space-y-6">
    <Link className="underline" href={`/dashboard/coordinator/question-banks/${id}`}>Back to question bank</Link>
    <h1 className="text-2xl font-semibold">Reviewed academic evidence · {data.bank.subjectCode} · {data.bank.subjectName}</h1>
    <UafReviewWorkspace initial={data} />
  </main>;
}
