import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ProductionService } from "@/modules/production/service";

const service = new ProductionService();

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-health-token");
  if (env.HEALTHCHECK_TOKEN && token !== env.HEALTHCHECK_TOKEN) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const overview = await service.getObservabilityOverview();
    return NextResponse.json({
      success: true,
      data: overview.health,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Health check failed" } },
      { status: 503 },
    );
  }
}
