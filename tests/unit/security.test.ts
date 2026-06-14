import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---- N3: Slot override IDOR ----
import { Role } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";

describe("N3 — Moderator slot override IDOR check", () => {
  const routePath = path.resolve("app/api/question-slots/[id]/override/route.ts");
  const source = fs.readFileSync(routePath, "utf-8");

  it("imports ModeratorBankAssignment lookup via prisma", () => {
    expect(source).toContain("prisma.moderatorBankAssignment.findFirst");
  });

  it("rejects unassigned moderators with ForbiddenError", () => {
    expect(source).toContain('ForbiddenError("You cannot override slots in this bank")');
  });

  it("performs check before slot lookup and reservation", () => {
    const checkIndex = source.indexOf("moderatorBankAssignment.findFirst");
    const slotIndex = source.indexOf("listSlots");
    expect(checkIndex).toBeGreaterThan(0);
    expect(slotIndex).toBeGreaterThan(checkIndex);
  });
});

// ---- N4: Dean notification targeting ----
describe("N4 — Dean notification targets bank department", () => {
  const servicePath = path.resolve("src/modules/production/service.ts");
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

  it("subjects validation blocks HTML in subjectName", () => {
    const subjectsPath = path.resolve("src/modules/subjects/validation.ts");
    const source = fs.readFileSync(subjectsPath, "utf-8");
    expect(source).toContain('subjectName: z.string().min(2).regex(/^[^<>&"]+$/');
  });
});

// ---- N13: CSP hardening ----
describe("N13 — CSP hardened", () => {
  it("removes unsafe-eval from script-src", () => {
    const configPath = path.resolve("next.config.ts");
    const source = fs.readFileSync(configPath, "utf-8");
    expect(source).toContain('"script-src');
    expect(source).not.toContain("unsafe-eval");
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
  it("subjects validation requires non-empty departmentId", () => {
    const src = fs.readFileSync(path.resolve("src/modules/subjects/validation.ts"), "utf-8");
    expect(src).toContain("departmentId: z.string().min(1)");
  });

  it("question-banks validation requires non-empty subjectId and examCycleId", () => {
    const src = fs.readFileSync(path.resolve("src/modules/question-banks/validation.ts"), "utf-8");
    expect(src).toContain("subjectId: z.string().min(1)");
    expect(src).toContain("examCycleId: z.string().min(1)");
  });

  it("assignments validation requires non-empty IDs", () => {
    const src = fs.readFileSync(path.resolve("src/modules/assignments/validation.ts"), "utf-8");
    expect(src).toContain("questionBankId: z.string().min(1)");
    expect(src).toContain("moderatorId: z.string().min(1)");
    expect(src).toContain("z.array(z.string().min(1))");
    expect(src).toContain("teacherId: z.string().min(1)");
  });

  it("exam-cycles validation requires non-empty departmentId", () => {
    const src = fs.readFileSync(path.resolve("src/modules/exam-cycles/validation.ts"), "utf-8");
    expect(src).toContain("departmentId: z.string().min(1).nullable().optional()");
  });

  it("users validation requires non-empty departmentId", () => {
    const src = fs.readFileSync(path.resolve("src/modules/users/validation.ts"), "utf-8");
    expect(src).toContain("departmentId: z.string().min(1).nullable().optional()");
  });
});
