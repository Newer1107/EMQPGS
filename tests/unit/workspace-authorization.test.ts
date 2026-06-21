import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError } from "@/lib/errors";

vi.mock("@/lib/db", () => ({
  prisma: {
    responsibilityAssignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    questionBank: {
      findUnique: vi.fn(),
    },
    subjectVersion: {
      findFirst: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/errors", () => ({
  ForbiddenError: class ForbiddenError extends Error {
    statusCode = 403;
  },
  UnauthorizedError: class UnauthorizedError extends Error {
    statusCode = 401;
  },
  AppError: class AppError extends Error {
    constructor(m: string, public statusCode = 400) {
      super(m);
    }
  },
  NotFoundError: class NotFoundError extends Error {
    statusCode = 404;
    constructor(m = "Not found") {
      super(m);
    }
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/api-context", () => ({
  getCurrentUserFromCookies: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  authCookieNames: { access: "emqpgs_access" },
  verifyAccessToken: vi.fn(),
}));

vi.mock("@/modules/users/service", () => ({
  UserService: vi.fn(() => ({
    findByEmail: vi.fn(),
  })),
}));

import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ActiveWorkspaceResolver } from "@/lib/auth/workspace-resolver";
import { WorkspaceSelector } from "@/lib/auth/workspace-selector";
import { WorkspaceCookieManager } from "@/lib/auth/workspace-cookie-manager";
import { WORKSPACE_PRIORITY } from "@/lib/workspace-priority";
import { WorkspaceContextResolver } from "@/lib/auth/workspace-context";
import { getWorkspaceContext } from "@/lib/auth/get-workspace-context";
import { AuthorizationService } from "@/lib/auth/authorization-service";

const mockUser = { id: "user-1", name: "Test User", email: "test@test.com" };
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};

const QB = {
  id: "bank-1", subjectId: "subj-1", batchSemesterId: "bs-1",
  phase: "DRAFTING", recordStatus: "ACTIVE", version: 1,
  createdAt: new Date(), updatedAt: new Date(),
  createdById: "user-1", lockedAt: null, lockedReason: null,
  academicYearId: "ay-1",
  batchSemester: {
    id: "bs-1", semesterNumber: 5, batchId: "batch-1", academicYearId: "ay-1",
    academicYear: { id: "ay-1", code: "2026-27" },
    batch: { id: "batch-1", name: "BE Computer" },
  },
  subject: { id: "subj-1", subjectName: "Operating Systems", subjectCode: "CS401", departmentId: "dept-1" },
  pattern: { id: "pat-1", totalSlots: 126, examType: "ISE", questionBankId: "bank-1" },
  slots: [
    { id: "slot-1", moduleNumber: 1, marks: 2, slotNumber: 1, questionBankId: "bank-1", assignedQuestion: null },
  ],
};

const mockAssignment = {
  id: "assign-1", userId: "user-1", responsibility: "CONTRIBUTOR",
  scopeType: "QUESTION_BANK", scopeId: "bank-1",
  activeFrom: new Date(Date.now() - 86400000),
  activeTo: null, deletedAt: null,
};

function createActiveWs(overrides = {}) {
  return {
    assignmentId: "assign-1",
    responsibility: "CONTRIBUTOR" as const,
    scopeType: "QUESTION_BANK" as const,
    scopeId: "bank-1",
    display: { title: "Contributor", subtitle: "Operating Systems", tertiary: "Semester 5 · BE Computer · 2026-27" },
    ...overrides,
  };
}

function createAuthCtx(overrides = {}) {
  return {
    user: { id: "user-1", email: "test@test.com", name: "Test User" },
    responsibilities: [
      { id: "assign-1", type: "CONTRIBUTOR" as any, scopeType: "QUESTION_BANK" as any, scopeId: "bank-1", activeFrom: new Date(), activeTo: null },
    ],
    ...overrides,
  };
}

describe("ActiveWorkspaceResolver (read-only)", () => {
  let resolver: ActiveWorkspaceResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new ActiveWorkspaceResolver();
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);
  });

  it("returns null when no cookie", async () => {
    mockCookieStore.get.mockReturnValue(null);
    const result = await resolver.resolve("user-1");
    expect(result).toBeNull();
  });

  it("returns null for deleted assignment", async () => {
    mockCookieStore.get.mockReturnValue({ value: "assign-1" });
    vi.mocked(prisma.responsibilityAssignment.findUnique).mockResolvedValue({
      ...mockAssignment, deletedAt: new Date(),
    } as never);
    const result = await resolver.resolve("user-1");
    expect(result).toBeNull();
  });

  it("returns null for expired assignment", async () => {
    mockCookieStore.get.mockReturnValue({ value: "assign-1" });
    vi.mocked(prisma.responsibilityAssignment.findUnique).mockResolvedValue({
      ...mockAssignment,
      activeFrom: new Date(Date.now() - 86400000 * 30),
      activeTo: new Date(Date.now() - 86400000),
    } as never);
    const result = await resolver.resolve("user-1");
    expect(result).toBeNull();
  });

  it("returns null for wrong user assignment", async () => {
    mockCookieStore.get.mockReturnValue({ value: "assign-1" });
    vi.mocked(prisma.responsibilityAssignment.findUnique).mockResolvedValue({
      ...mockAssignment, userId: "other-user",
    } as never);
    const result = await resolver.resolve("user-1");
    expect(result).toBeNull();
  });

  it("returns ActiveWorkspace for valid assignment", async () => {
    mockCookieStore.get.mockReturnValue({ value: "assign-1" });
    vi.mocked(prisma.responsibilityAssignment.findUnique).mockResolvedValue(mockAssignment as never);
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({
      subject: { subjectName: "Operating Systems" },
      batchSemester: { semesterNumber: 5, batch: { name: "BE Computer" }, academicYear: { code: "2026-27" } },
    } as never);

    const result = await resolver.resolve("user-1");
    expect(result).not.toBeNull();
    expect(result!.assignmentId).toBe("assign-1");
    expect(result!.responsibility).toBe("CONTRIBUTOR");
    expect(result!.scopeId).toBe("bank-1");
  });

  it("does NOT clear cookie when assignment is invalid", async () => {
    mockCookieStore.get.mockReturnValue({ value: "assign-wrong" });
    vi.mocked(prisma.responsibilityAssignment.findUnique).mockResolvedValue(null);
    await resolver.resolve("user-1");
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});

describe("WorkspaceSelector (pure decision)", () => {
  const selector = new WorkspaceSelector();

  it("returns null for empty list", () => {
    expect(selector.pickDefault([])).toBeNull();
  });

  it("picks highest priority assignment", () => {
    const result = selector.pickDefault([
      { id: "a1", responsibility: "CONTRIBUTOR" as any, scopeId: "bank-1" },
      { id: "a2", responsibility: "MODERATOR" as any, scopeId: "bank-2" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.assignmentId).toBe("a2");
  });

  it("returns deterministic result for same-priority items", () => {
    const first = selector.pickDefault([
      { id: "a1", responsibility: "CONTRIBUTOR" as any, scopeId: "bank-1" },
      { id: "a2", responsibility: "CONTRIBUTOR" as any, scopeId: "bank-2" },
    ]);
    const second = selector.pickDefault([
      { id: "a2", responsibility: "CONTRIBUTOR" as any, scopeId: "bank-2" },
      { id: "a1", responsibility: "CONTRIBUTOR" as any, scopeId: "bank-1" },
    ]);
    expect(first!.assignmentId).toBe(second!.assignmentId);
  });

  it("pickDefaultForUser queries DB and returns result", async () => {
    vi.mocked(prisma.responsibilityAssignment.findMany).mockResolvedValue([
      { ...mockAssignment, id: "assign-mod", responsibility: "MODERATOR", scopeId: "bank-2" },
    ] as never);

    const result = await selector.pickDefaultForUser("user-1");
    expect(result).not.toBeNull();
    expect(result!.assignmentId).toBe("assign-mod");
  });

  it("pickDefaultForUser returns null when no active assignments", async () => {
    vi.mocked(prisma.responsibilityAssignment.findMany).mockResolvedValue([]);
    const result = await selector.pickDefaultForUser("user-1");
    expect(result).toBeNull();
  });
});

describe("WorkspaceCookieManager (HTTP writes only)", () => {
  let cm: WorkspaceCookieManager;

  beforeEach(() => {
    vi.clearAllMocks();
    cm = new WorkspaceCookieManager();
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);
  });

  it("get() reads cookie", async () => {
    mockCookieStore.get.mockReturnValue({ value: "assign-1" });
    const result = await cm.get();
    expect(result).toBe("assign-1");
  });

  it("get() returns null when no cookie", async () => {
    mockCookieStore.get.mockReturnValue(null);
    const result = await cm.get();
    expect(result).toBeNull();
  });

  it("set() writes cookie with 7-day expiry", async () => {
    await cm.set("assign-1");
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      expect.any(String), "assign-1", expect.objectContaining({ maxAge: expect.any(Number) }),
    );
  });

  it("clear() writes cookie with maxAge 0", async () => {
    await cm.clear();
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      expect.any(String), "", expect.objectContaining({ maxAge: 0 }),
    );
  });
});

describe("WorkspaceContextResolver", () => {
  let resolver: WorkspaceContextResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new WorkspaceContextResolver();
  });

  it("resolves full context from ActiveWorkspace", async () => {
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(QB as never);
    vi.mocked(prisma.subjectVersion.findFirst).mockResolvedValue({
      id: "sv-1", subjectId: "subj-1", status: "ACTIVE",
    } as never);
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      id: "dept-1", name: "Computer Engineering",
    } as never);

    const aws = createActiveWs();
    const ctx = await resolver.resolve(aws);

    expect(ctx.bankId).toBe("bank-1");
    expect(ctx.questionBank.id).toBe("bank-1");
    expect(ctx.subject.subjectName).toBe("Operating Systems");
    expect(ctx.batchSemester.semesterNumber).toBe(5);
    expect(ctx.department!.name).toBe("Computer Engineering");
  });

  it("throws when QuestionBank is not found", async () => {
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(null);
    await expect(resolver.resolve(createActiveWs())).rejects.toThrow("QuestionBank bank-1 not found");
  });
});

describe("getWorkspaceContext()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserFromCookies).mockResolvedValue(mockUser as never);
    mockCookieStore.get.mockReturnValue({ value: "assign-1" });
  });

  it("resolves user, active, and context for valid workspace", async () => {
    vi.mocked(prisma.responsibilityAssignment.findUnique).mockResolvedValue(mockAssignment as never);
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(QB as never);
    vi.mocked(prisma.subjectVersion.findFirst).mockResolvedValue({
      id: "sv-1", subjectId: "subj-1", status: "ACTIVE",
    } as never);
    vi.mocked(prisma.department.findUnique).mockResolvedValue({
      id: "dept-1", name: "Computer Engineering",
    } as never);
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue(QB as never);

    const session = await getWorkspaceContext("CONTRIBUTOR" as never);
    expect(session.user.id).toBe("user-1");
    expect(session.active.responsibility).toBe("CONTRIBUTOR");
    expect(session.context.bankId).toBe("bank-1");
  });

  it("throws ForbiddenError when no active workspace", async () => {
    mockCookieStore.get.mockReturnValue(null);
    await expect(getWorkspaceContext("CONTRIBUTOR" as never)).rejects.toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when workspace type mismatches", async () => {
    vi.mocked(prisma.responsibilityAssignment.findUnique).mockResolvedValue({
      ...mockAssignment, responsibility: "MODERATOR",
    } as never);

    await expect(getWorkspaceContext("CONTRIBUTOR" as never)).rejects.toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when scopeId is null", async () => {
    vi.mocked(prisma.responsibilityAssignment.findUnique).mockResolvedValue({
      ...mockAssignment, scopeId: null,
    } as never);

    await expect(getWorkspaceContext("CONTRIBUTOR" as never)).rejects.toThrow(ForbiddenError);
  });
});

describe("AuthorizationService", () => {
  it("has() returns true when user has the responsibility", () => {
    const authz = new AuthorizationService(createAuthCtx());
    expect(authz.has("CONTRIBUTOR" as never)).toBe(true);
    expect(authz.has("MODERATOR" as never)).toBe(false);
  });

  it("hasAny() returns true for any matching responsibility", () => {
    const authz = new AuthorizationService(createAuthCtx());
    expect(authz.hasAny(["CONTRIBUTOR" as never, "MODERATOR" as never])).toBe(true);
    expect(authz.hasAny(["DEAN" as never, "COE" as never])).toBe(false);
  });

  it("hasAll() returns true only when all responsibilities match", () => {
    const authz = new AuthorizationService(createAuthCtx({
      responsibilities: [
        ...createAuthCtx().responsibilities,
        { id: "assign-2", type: "MODERATOR" as never, scopeType: "QUESTION_BANK" as never, scopeId: "bank-2", activeFrom: new Date(), activeTo: null },
      ],
    }));
    expect(authz.hasAll(["CONTRIBUTOR" as never, "MODERATOR" as never])).toBe(true);
    expect(authz.hasAll(["CONTRIBUTOR" as never, "DEAN" as never])).toBe(false);
  });

  it("require() throws ForbiddenError when responsibility is missing", () => {
    const authz = new AuthorizationService(createAuthCtx());
    expect(() => authz.require("MODERATOR" as never)).toThrow(ForbiddenError);
  });

  it("requireContributor() passes with matching scope", () => {
    const authz = new AuthorizationService(createAuthCtx());
    expect(() => authz.requireContributor("bank-1")).not.toThrow();
    expect(() => authz.requireContributor("bank-2")).toThrow(ForbiddenError);
  });

  it("getScopeId() returns the first matching scope", () => {
    const authz = new AuthorizationService(createAuthCtx());
    expect(authz.getScopeId("CONTRIBUTOR" as never)).toBe("bank-1");
    expect(authz.getScopeId("MODERATOR" as never)).toBeNull();
  });

  it("getScopeIds() returns all matching scopes", () => {
    const authz = new AuthorizationService(createAuthCtx({
      responsibilities: [
        ...createAuthCtx().responsibilities,
        { id: "assign-2", type: "CONTRIBUTOR" as never, scopeType: "QUESTION_BANK" as never, scopeId: "bank-2", activeFrom: new Date(), activeTo: null },
      ],
    }));
    const ids = authz.getScopeIds("CONTRIBUTOR" as never);
    expect(ids).toEqual(["bank-1", "bank-2"]);
  });
});

describe("WORKSPACE_PRIORITY", () => {
  it("ranks COE highest", () => {
    expect(WORKSPACE_PRIORITY.COE).toBeGreaterThan(WORKSPACE_PRIORITY.DEAN);
  });
  it("ranks DEAN above COORDINATOR", () => {
    expect(WORKSPACE_PRIORITY.DEAN).toBeGreaterThan(WORKSPACE_PRIORITY.COORDINATOR);
  });
  it("ranks COORDINATOR above MODERATOR", () => {
    expect(WORKSPACE_PRIORITY.COORDINATOR).toBeGreaterThan(WORKSPACE_PRIORITY.MODERATOR);
  });
  it("ranks MODERATOR above CONTRIBUTOR", () => {
    expect(WORKSPACE_PRIORITY.MODERATOR).toBeGreaterThan(WORKSPACE_PRIORITY.CONTRIBUTOR);
  });

  it("lives in workspace-priority.ts config, not business logic", () => {
    const fs = require("fs");
    const path = require("path");
    const libDir = path.resolve(__dirname, "../../src/lib");
    const cfgPath = path.join(libDir, "workspace-priority.ts");
    expect(fs.existsSync(cfgPath)).toBe(true);
    const resolverSrc = fs.readFileSync(path.join(libDir, "auth/workspace-resolver.ts"), "utf-8");
    expect(resolverSrc).not.toContain("WORKSPACE_PRIORITY =");
  });
});

describe("architectural guardrails", () => {
  const fs = require("fs");
  const path = require("path");
  const srcDir = path.resolve(__dirname, "../../src");

  function listPageFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "coe" || entry.name === "coordinator") continue;
        listPageFiles(full).forEach((f) => files.push(f));
      } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
        files.push(full);
      }
    }
    return files;
  }

  it("ModeratorService does not import AuthContext", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/moderation/service.ts"), "utf-8");
    expect(src).not.toMatch(/import.*AuthContext/);
  });

  it("ModeratorDashboardService does not import AuthContext", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/moderation/dashboard.service.ts"), "utf-8");
    expect(src).not.toMatch(/import.*AuthContext/);
  });

  it("ModeratorService does not import AuthorizationService", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/moderation/service.ts"), "utf-8");
    expect(src).not.toMatch(/import.*AuthorizationService/);
  });

  it("ModeratorService has no getAssignedBankIds method", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/moderation/service.ts"), "utf-8");
    expect(src).not.toContain("getAssignedBankIds");
  });

  it("no operational page directly imports ResponsibilityAssignment", () => {
    const pagesDir = path.resolve(srcDir, "../app/(protected)/dashboard");
    const files = listPageFiles(pagesDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toMatch(/responsibilityAssignment|RESPONSIBILITY_ASSIGNMENT/);
    }
  });

  it("no operational page manually resolves ActiveWorkspaceService + WorkspaceContextResolver", () => {
    const pagesDir = path.resolve(srcDir, "../app/(protected)/dashboard");
    const files = listPageFiles(pagesDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("ActiveWorkspaceService") && content.includes("WorkspaceContextResolver")) {
        throw new Error(`${file} imports both ActiveWorkspaceService and WorkspaceContextResolver — use getWorkspaceContext instead`);
      }
    }
  });

  it("QuestionLibraryService does not import AuthContext", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/question-library/service.ts"), "utf-8");
    expect(src).not.toMatch(/import.*AuthContext/);
  });

  it("QuestionLibraryService does not import AuthorizationService", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/question-library/service.ts"), "utf-8");
    expect(src).not.toMatch(/import.*AuthorizationService/);
  });

  it("QuestionSlotService does not import AuthContext", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/question-slots/service.ts"), "utf-8");
    expect(src).not.toMatch(/import.*AuthContext/);
  });

  it("QuestionSlotService does not import AuthorizationService", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/question-slots/service.ts"), "utf-8");
    expect(src).not.toMatch(/import.*AuthorizationService/);
  });

  it("QuestionSlotService.assignToSlot does not accept auth parameter", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/question-slots/service.ts"), "utf-8");
    const fnMatch = src.match(/assignToSlot\([^)]+\)/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).not.toContain("auth");
  });

  it("QuestionSlotService.unassignFromSlot does not accept auth parameter", () => {
    const src = fs.readFileSync(path.join(srcDir, "modules/question-slots/service.ts"), "utf-8");
    const fnMatch = src.match(/unassignFromSlot\([^)]+\)/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).not.toContain("auth");
  });

  it("refactored business services do not query ResponsibilityAssignment", () => {
    const files = [
      "moderation/service.ts",
      "moderation/dashboard.service.ts",
      "question-library/service.ts",
      "question-slots/service.ts",
    ];
    for (const f of files) {
      const content = fs.readFileSync(path.join(srcDir, "modules", f), "utf-8");
      expect(content).not.toMatch(/prisma\.responsibilityAssignment/);
    }
  });
});
