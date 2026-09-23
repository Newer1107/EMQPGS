import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import BatchHistoryPage from "../../app/(protected)/dashboard/coe/batches/[id]/history/page";

vi.mock("@/lib/db", () => ({ prisma: { batch: { findUnique: vi.fn() } } }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

describe("batch history", () => {
  it("queries only the requested batch and renders recorded semesters and cycle navigation", async () => {
    vi.mocked(prisma.batch.findUnique).mockResolvedValue({
      name: "2026 Batch", status: "ACTIVE", createdAt: new Date("2026-01-01"),
      batchSemesters: [{ id: "semester", semesterNumber: 2, academicYear: { code: "2026-27" }, status: "COMPLETED", startDate: null, endDate: null,
        examCycles: [{ id: "cycle-2", examType: "REGULAR", status: "CLOSED", startDate: null, endDate: null }] }],
    } as never);
    const html = renderToStaticMarkup(await BatchHistoryPage({ params: Promise.resolve({ id: "batch-1" }) }));
    expect(prisma.batch.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "batch-1" }, include: expect.objectContaining({ batchSemesters: expect.any(Object) }) }));
    expect(html).toContain("COMPLETED");
    expect(html).toContain("/dashboard/coe/exam-cycles/cycle-2");
    expect(html).toContain("CLOSED");
    expect(html).not.toContain("Coming Soon");
  });
  it("shows no history for an existing batch without semesters", async () => {
    vi.mocked(prisma.batch.findUnique).mockResolvedValue({ name: "Empty", status: "ACTIVE", createdAt: new Date(), batchSemesters: [] } as never);
    expect(renderToStaticMarkup(await BatchHistoryPage({ params: Promise.resolve({ id: "empty" }) }))).toContain("No semester history recorded");
  });
  it("returns not found for unknown batches", async () => {
    vi.mocked(prisma.batch.findUnique).mockResolvedValue(null);
    await expect(BatchHistoryPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NOT_FOUND");
  });
});
