import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import { WordExportService } from "@/modules/paper-generation/word-export.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    const resolver = new ResponsibilityResolver();
    const auth = await resolver.resolveAsContext(user.id, user);
    new AuthorizationService(auth).requireAny(["COORDINATOR" as const, "DEAN" as const]);
  } catch {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const segments = request.nextUrl.pathname.split("/");
  const variantIdx = segments.indexOf("papers") + 1;
  const variant = segments[variantIdx];
  const questionBankId = segments[variantIdx - 2];

  try {
    const service = new WordExportService();
    const result = await service.export(questionBankId, variant);
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mime,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 404 });
  }
}
