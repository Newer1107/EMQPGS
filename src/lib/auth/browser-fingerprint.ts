import crypto from "node:crypto";

/**
 * Browser Fingerprint — privacy-friendly client fingerprint for security binding.
 *
 * Derives a SHA-256 hash from stable HTTP request headers:
 *   - User-Agent
 *   - Accept-Language
 *   - Platform (Sec-CH-UA-Platform or x-platform)
 *
 * DESIGN:
 *   - NOT invasive fingerprinting (no canvas, no fonts, no WebGL)
 *   - Only stable request headers that don't change per request
 *   - Stored as a hash — never stored in raw form
 *   - Privacy-friendly: cannot reconstruct the original headers from the hash
 *   - Prevents copied session cookies from being reused across different browsers
 *
 * The fingerprint is used for:
 *   1. OTP binding — OTP verified from browser A cannot be used from browser B
 *   2. Step-up sessions — step-up verified from browser A not valid from browser B
 */

export type BrowserFingerprint = string; // SHA-256 hex digest

const SALT = "emqpgs-browser-fp-v1";

/**
 * Derive a browser fingerprint from request headers.
 *
 * @param userAgent - The User-Agent header value
 * @param acceptLanguage - The Accept-Language header value (optional)
 * @param platform - The platform hint (Sec-CH-UA-Platform or x-platform, optional)
 * @returns SHA-256 hex digest of the stable headers
 */
export function deriveBrowserFingerprint(
  userAgent: string | null,
  acceptLanguage?: string | null,
  platform?: string | null,
): BrowserFingerprint {
  const parts = [
    userAgent ?? "",
    SALT,
    acceptLanguage?.split(",")[0]?.trim() ?? "",
    platform ?? "",
  ];
  return crypto.createHash("sha256").update(parts.join("||")).digest("hex");
}

/**
 * Extract browser fingerprint components from a Next.js Request or standard Request.
 */
export function extractFingerprintHeaders(request: {
  headers: Headers | Record<string, string>;
}): { userAgent: string | null; acceptLanguage: string | null; platform: string | null } {
  const h = request.headers instanceof Headers ? request.headers : new Headers(request.headers);
  return {
    userAgent: h.get("user-agent"),
    acceptLanguage: h.get("accept-language"),
    platform: h.get("sec-ch-ua-platform") ?? h.get("x-platform"),
  };
}

/**
 * Convenience: derive fingerprint directly from a request object.
 */
export function getBrowserFingerprintFromRequest(request: {
  headers: Headers | Record<string, string>;
}): BrowserFingerprint {
  const { userAgent, acceptLanguage, platform } = extractFingerprintHeaders(request);
  return deriveBrowserFingerprint(userAgent, acceptLanguage, platform);
}
