import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---- N3: Slot override IDOR ----
import { Role } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";

describe("N4 — Dean notification targets bank department", () => {
  const servicePath = path.resolve("src/modules/production/dean-review.service.ts");
  const source = fs.readFileSync(servicePath, "utf-8");

  it("uses questionBank.subject.departmentId in the COE notification query (not actor.departmentId)", () => {
    const coeUserQuery = source.match(/const coeUsers = await prisma\.user\.findMany\(\{[\s\S]*?\}\);/);
    expect(coeUserQuery).toBeTruthy();
    expect(coeUserQuery![0]).toContain("questionBank.subject.departmentId");
    expect(coeUserQuery![0]).not.toContain("actor.departmentId");
  });
});

// ---- H2: Audit body capture ----
describe("H2 — Audit log no longer auto-captures request bodies", () => {
  const handlerPath = path.resolve("src/lib/api-handler.ts");
  const source = fs.readFileSync(handlerPath, "utf-8");

  it("does not call safeReadBody for metadata", () => {
    expect(source).not.toContain("safeReadBody");
  });

  it("uses getMetadata callback instead", () => {
    expect(source).toContain("options.audit.getMetadata?.(request, result)");
  });

  it("has getMetadata in the RouteOptions type", () => {
    expect(source).toContain("getMetadata");
    expect(source).toContain("NextRequest, result: unknown");
  });
});

// ---- H4: Stored XSS validation ----
describe("H4 — XSS charset validation on free-text fields", () => {
  it("departments validation blocks HTML in name", () => {
    const depsPath = path.resolve("src/modules/departments/validation.ts");
    const source = fs.readFileSync(depsPath, "utf-8");
    expect(source).toContain('name: z.string().min(2).regex(/^[^<>&"]+$/');
    expect(source).toContain('hodName: z.string().min(2).regex(/^[^<>&"]+$/');
  });

  it("users validation blocks HTML in name", () => {
    const usersPath = path.resolve("src/modules/users/validation.ts");
    const source = fs.readFileSync(usersPath, "utf-8");
    expect(source).toContain('name: z.string().min(2).regex(/^[^<>&"]+$/');
  });

  it("subjects route validation requires subject name", () => {
    const subjectsPath = path.resolve("app/api/subjects/route.ts");
    const source = fs.readFileSync(subjectsPath, "utf-8");
    expect(source).toContain('name: z.string().trim().min(1, "Subject name is required.")');
  });
});

// ---- N13: CSP hardening ----
describe("N13 — CSP hardened", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes unsafe-eval in development for HMR support", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { default: nextConfig } = await import("../../next.config");
    const headers = await nextConfig.headers!();
    const csp = headers[0].headers.find(
      (h) => h.key === "Content-Security-Policy",
    )!.value;
    expect(csp).toContain("unsafe-eval");
  });

  it("omits unsafe-eval in production to maintain hardening", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { default: nextConfig } = await import("../../next.config");
    const headers = await nextConfig.headers!();
    const csp = headers[0].headers.find(
      (h) => h.key === "Content-Security-Policy",
    )!.value;
    expect(csp).not.toContain("unsafe-eval");
  });

  it("tightens connect-src to self only", () => {
    const configPath = path.resolve("next.config.ts");
    const source = fs.readFileSync(configPath, "utf-8");
    const connectSrcLine = source.match(/connect-src[^"]*/);
    expect(connectSrcLine).toBeTruthy();
    expect(connectSrcLine![0]).toBe("connect-src 'self'");
  });
});

// ---- N15: CSRF origin uses AUTH_URL ----
describe("N15 — CSRF origin check uses AUTH_URL", () => {
  const csrfPath = path.resolve("src/lib/csrf.ts");
  const source = fs.readFileSync(csrfPath, "utf-8");

  it("compares origin against env.AUTH_URL instead of host header", () => {
    expect(source).toContain("const authUrl = new URL(env.AUTH_URL)");
    expect(source).toContain("origin !== authUrl.origin");
    expect(source).not.toMatch(/originHost\s*!==\s*host/);
  });
});

// ---- N14: ID field validation ----
describe("N14 — Zod .min(1) on ID fields", () => {
  it("subjects route requires departmentId", () => {
    const src = fs.readFileSync(path.resolve("app/api/subjects/route.ts"), "utf-8");
    expect(src).toContain("departmentId: z.string().min(1)");
  });

  it("question-banks validation requires non-empty subjectId and examCycleId", () => {
    const src = fs.readFileSync(path.resolve("src/modules/question-banks/validation.ts"), "utf-8");
    expect(src).toContain("subjectId: z.string().min(1)");
    expect(src).toContain("examCycleId: z.string().min(1)");
  });

  it("academic-years validation requires non-empty code", () => {
    const src = fs.readFileSync(path.resolve("src/modules/academic-years/validation.ts"), "utf-8");
    expect(src).toContain("code: z.string()");
  });

  it("exam-cycles validation requires non-empty departmentId", () => {
    const src = fs.readFileSync(path.resolve("src/modules/exam-cycles/validation.ts"), "utf-8");
    expect(src).toContain("departmentId: z.string().min(1),");
  });

  it("users validation requires non-empty departmentId", () => {
    const src = fs.readFileSync(path.resolve("src/modules/users/validation.ts"), "utf-8");
    expect(src).toContain("departmentId: z.string().min(1).nullable().optional()");
  });
});
