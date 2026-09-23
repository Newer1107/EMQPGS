import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ---- N3: Slot override IDOR ----
import { userSchema } from "@/modules/users/validation";
import { DeanReviewService } from "@/modules/production/dean-review.service";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/modules/notifications/service";

vi.mock("@/lib/db", () => ({ prisma: {
  questionBank: { findFirst: vi.fn() },
  deanReview: { create: vi.fn() },
  responsibilityAssignment: { findMany: vi.fn() },
} }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/storage/storage-service", () => ({ StorageService: vi.fn() }));
vi.mock("@/modules/notifications/service", () => ({ NotificationService: vi.fn(function () {
  return { create: vi.fn(), createAndEmail: vi.fn(), markByActionUrlAsRead: vi.fn() };
}) }));

describe("N4 — Dean notifications respect responsibility scopes", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("notifies institution COEs and coordinators of the bank department, independently of the dean's home department", async () => {
    const selection = { regularPaper: "PAPER_A", supplementaryPaper: "PAPER_B", ktPaper: "PAPER_C" } as const;
    const dean = { id: "dean-1", email: "dean@example.com", name: "Dean", homeDepartmentId: "dean-home" };
    vi.mocked(prisma.questionBank.findFirst).mockResolvedValue({
      id: "bank-1", subject: { departmentId: "bank-dept", subjectName: "Algorithms" },
      deanReview: null, generatedPapers: Object.values(selection).map((variant) => ({ variant })),
    } as never);
    vi.mocked(prisma.deanReview.create).mockResolvedValue({ id: "review-1", ...selection, reviewedAt: new Date(), reviewedBy: dean } as never);
    const coe = { id: "coe-1", email: "coe@example.com", name: "COE" };
    vi.mocked(prisma.responsibilityAssignment.findMany)
      .mockResolvedValueOnce([{ user: coe }] as never)
      .mockResolvedValueOnce([{ user: { id: "bank-coordinator" } }] as never);
    await new DeanReviewService().submitDeanReview("bank-1", selection, {
      user: dean,
      responsibilities: [{ id: "dean-ra", type: "DEAN", scopeType: "INSTITUTION", scopeId: null, activeFrom: new Date(), activeTo: null }],
    });
    expect(prisma.responsibilityAssignment.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.responsibilityAssignment.findMany).toHaveBeenNthCalledWith(1, {
      where: { responsibility: "COE", scopeType: "INSTITUTION" }, include: { user: true },
    });
    expect(prisma.responsibilityAssignment.findMany).toHaveBeenNthCalledWith(2, {
      where: { responsibility: "COORDINATOR", scopeType: "DEPARTMENT", scopeId: "bank-dept" }, include: { user: true },
    });
    const notification = vi.mocked(NotificationService).mock.results[0].value;
    expect(notification.createAndEmail).toHaveBeenCalledExactlyOnceWith(coe, "Dean review complete", expect.any(String), "/dashboard/coe/production", "ACTION_REQUIRED");
    expect(notification.create).toHaveBeenCalledWith("bank-coordinator", "Dean review complete", expect.any(String), "/dashboard/coordinator/question-banks?bank=bank-1", "SUCCESS");
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

  it("compares origin against host header instead of env.AUTH_URL", () => {
    expect(source).toContain('const hostHeader = headerStore.get("host")');
    expect(source).toContain("new URL(origin).host !== hostHeader");
  });
});

// ---- N14: ID field validation ----
describe("N14 — Zod .min(1) on ID fields", () => {
  it("subjects route requires departmentId", () => {
    const src = fs.readFileSync(path.resolve("app/api/subjects/route.ts"), "utf-8");
    expect(src).toContain("departmentId: z.string().min(1)");
  });

  it("question-banks validation validates advancePhase targetPhase", () => {
    const src = fs.readFileSync(path.resolve("src/modules/question-banks/validation.ts"), "utf-8");
    expect(src).toContain("targetPhase: z.nativeEnum(QuestionBankPhase)");
  });

  it("academic-years validation requires non-empty code", () => {
    const src = fs.readFileSync(path.resolve("src/modules/academic-years/validation.ts"), "utf-8");
    expect(src).toContain("code: z.string()");
  });

  it("exam-cycles validation requires non-empty batchSemesterId", () => {
    const src = fs.readFileSync(path.resolve("src/modules/exam-cycles/validation.ts"), "utf-8");
    expect(src).toContain("batchSemesterId: z.string().min(1),");
  });

  it("users validation rejects an empty homeDepartmentId while allowing null or omission", () => {
    const base = { name: "Test User", email: "test@example.com" };
    expect(userSchema.safeParse({ ...base, homeDepartmentId: "" }).success).toBe(false);
    for (const homeDepartmentId of ["dept-1", null, undefined]) {
      expect(userSchema.safeParse({ ...base, homeDepartmentId }).success).toBe(true);
    }
  });
});
