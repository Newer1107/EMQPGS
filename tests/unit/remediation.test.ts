import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock bcryptjs for C1
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("mocked-hash-value"),
  compare: vi.fn(),
  genSalt: vi.fn().mockResolvedValue("mocked-salt"),
  default: { hash: vi.fn().mockResolvedValue("mocked-hash-value"), compare: vi.fn() },
}));

// Mock external dependencies for C2 (withApiHandler test)
vi.mock("@/lib/api-context", () => ({
  getCurrentUserFromCookies: vi.fn().mockResolvedValue(null),
  getRequestMeta: vi.fn().mockResolvedValue({ ipAddress: "127.0.0.1", userAgent: "vitest" }),
}));
vi.mock("@/lib/csrf", () => ({
  assertCsrfProtection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  prisma: { auditLog: { findMany: vi.fn() } },
}));

// --- C1: User creation strips password before repository.create ---
import { UserService } from "@/modules/users/service";

describe("C1 — User creation strips password", () => {
  let mockRepo: { findByEmail: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let service: UserService;

  beforeEach(() => {
    mockRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "u-1", name: "Test", email: "test@test.com" }),
    };
    service = new UserService(mockRepo as any);
  });

  it("does not pass password field to repository.create", async () => {
    await service.create({
      name: "Test User",
      email: "test@example.com",
      homeDepartmentId: "dept-1",
      password: "secret123",
    });
    expect(mockRepo.create).toHaveBeenCalledOnce();
    const callArg = mockRepo.create.mock.calls[0][0];
    expect(callArg).not.toHaveProperty("password");
    expect(callArg).toHaveProperty("passwordHash", "mocked-hash-value");
  });

  it("rejects duplicate email", async () => {
    mockRepo.findByEmail.mockResolvedValue({ id: "existing" });
    await expect(
      service.create({ name: "Dup", email: "dup@test.com", homeDepartmentId: "dept-1", password: "secret123" }),
    ).rejects.toThrow("Email already exists");
  });

  it("rejects missing password", async () => {
    await expect(
      service.create({ name: "No Pass", email: "nopass@test.com", homeDepartmentId: "dept-1" }),
    ).rejects.toThrow("Password is required");
  });
});

// --- C2: Zod validation errors return 400 instead of 500 ---
import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { ZodError, z } from "zod";

function mockRequest(method = "POST", path = "/api/test"): NextRequest {
  const url = new URL(`http://localhost${path}`);
  return {
    method,
    nextUrl: url,
    headers: new Headers(),
    clone: () => ({ json: () => Promise.resolve({}) }),
  } as unknown as NextRequest;
}

describe("C2 — ZodError returns 400 via handleApiError", () => {
  it("returns 400 with VALIDATION_ERROR code when handler throws ZodError", async () => {
    const schema = z.object({ name: z.string() });
    const handler = withApiHandler(async () => {
      schema.parse({});
      return { ok: true };
    });
    const res = await handler(mockRequest("POST")) as Response;
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("still returns 500 for non-AppError non-ZodError exceptions", async () => {
    const handler = withApiHandler(async () => {
      throw new Error("Boom");
    });
    const res = await handler(mockRequest("POST")) as Response;
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

// --- N1: Audit log route excludes passwordHash from actor ---
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

describe("N1 — Audit log route excludes passwordHash", () => {
  const routePath = path.join(repoRoot, "app/api/audit-logs/route.ts");
  const source = fs.readFileSync(routePath, "utf-8");

  it("uses nested select on actor relation instead of include: true", () => {
    expect(source).toContain("actor: { select:");
    expect(source).not.toContain("actor: true");
  });

  it("selects only safe public fields", () => {
    expect(source).toMatch(/select:\s*\{ id: true, name: true, email: true \}/);
    expect(source).not.toContain("passwordHash");
  });
});

// --- C5: Dockerfile installs mysql-client ---
describe("C5 — Dockerfile provides mysqldump dependency", () => {
  const dockerPath = path.join(repoRoot, "Dockerfile");
  const source = fs.readFileSync(dockerPath, "utf-8");

  it("installs mysql-client in the runner stage", () => {
    expect(source).toContain("RUN apk add --no-cache mysql-client");
  });
});
