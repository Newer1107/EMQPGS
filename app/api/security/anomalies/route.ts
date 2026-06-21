import { withApiHandler } from "@/lib/api-handler";
import { ResponsibilityType } from "@prisma/client";
import { AnomalyDetectionService } from "@/lib/auth/anomaly-detection";

export const GET = withApiHandler(
  async () => {
    const detector = new AnomalyDetectionService();
    const anomalies = await detector.runAll();
    return { anomalies, total: anomalies.length };
  },
  {
    responsibility: ["COE" as ResponsibilityType],
  },
);
