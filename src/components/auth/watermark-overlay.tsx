import { WatermarkService } from "@/lib/auth/watermark-service";
import { SecurityConfig } from "@/lib/auth/security-config";

interface WatermarkOverlayProps {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  userRole: string;
  sessionId: string;
  documentId?: string;
}

export function WatermarkOverlay({
  children,
  userName,
  userEmail,
  userRole,
  sessionId,
  documentId,
}: WatermarkOverlayProps) {
  const cfg = SecurityConfig.getInstance();
  const features = cfg.getFeatures();
  const showWatermark = features.browserWatermark;

  if (!showWatermark) {
    return <>{children}</>;
  }

  const svc = new WatermarkService();
  const watermarkText = svc.getBrowserWatermarkHTML({
    userName,
    userEmail,
    userRole,
    sessionId,
    documentId: documentId ?? "N/A",
    downloadId: svc.generateDownloadId(),
    timestamp: new Date(),
  });

  const line = watermarkText || "EMQPGS — CONFIDENTIAL";

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          pointerEvents: "none",
          overflow: "hidden",
          userSelect: "none",
          opacity: 0.06,
          fontFamily: "monospace",
          fontSize: "1rem",
          fontWeight: 500,
          color: "#000",
          lineHeight: "4rem",
        }}
      >
        <div
          style={{
            transform: "rotate(-30deg) translateY(-10%)",
            transformOrigin: "center center",
            width: "200%",
            marginLeft: "-50%",
          }}
        >
          {Array.from({ length: 16 }).map((_, ri) => (
            <div key={ri} style={{ whiteSpace: "nowrap", textAlign: "center" }}>
              {line}
              {"  "}
              {line}
              {"  "}
              {line}
              {"  "}
              {line}
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-0">{children}</div>
    </div>
  );
}
