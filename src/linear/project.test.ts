import { describe, expect, it, vi } from "vitest";
import { assignProjectIssues, listProjects } from "./project";
import { LinearApiClient } from "./client";

function createMockClient(overrides: Record<string, unknown> = {}): LinearApiClient {
  const base = {
    getProjectByName: vi.fn(),
    getCurrentUser: vi.fn(),
    getIssuesByProject: vi.fn(),
    updateIssue: vi.fn()
  };

  return { ...base, ...overrides } as unknown as LinearApiClient;
}

describe("assignProjectIssues", () => {
  it("assigns only unassigned issues by default", async () => {
    const updateIssue = vi.fn().mockResolvedValue({ success: true });
    const client = createMockClient({
      getProjectByName: vi.fn().mockResolvedValue({ id: "p1" }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: "u1" }),
      getIssuesByProject: vi.fn().mockResolvedValue([
        { id: "i1", assigneeId: null },
        { id: "i2", assigneeId: "u2" }
      ]),
      updateIssue
    });

    const result = await assignProjectIssues({ projectName: "Engine" }, client);

    expect(result).toEqual({ totalIssues: 2, assignedCount: 1, skippedCount: 1 });
    expect(updateIssue).toHaveBeenCalledTimes(1);
  });

  it("reassigns all issues with force", async () => {
    const updateIssue = vi.fn().mockResolvedValue({ success: true });
    const client = createMockClient({
      getProjectByName: vi.fn().mockResolvedValue({ id: "p1" }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: "u1" }),
      getIssuesByProject: vi.fn().mockResolvedValue([
        { id: "i1", assigneeId: null },
        { id: "i2", assigneeId: "u2" }
      ]),
      updateIssue
    });

    const result = await assignProjectIssues({ projectName: "Engine", force: true }, client);

    expect(result).toEqual({ totalIssues: 2, assignedCount: 2, skippedCount: 0 });
    expect(updateIssue).toHaveBeenCalledTimes(2);
  });
});

describe("listProjects", () => {
  it("maps and sorts projects by name", async () => {
    const client = createMockClient({
      getProjects: vi.fn().mockResolvedValue([
        {
          id: "p2",
          name: "Zeta",
          state: "planned",
          progress: 0,
          startDate: "2026-02-01",
          targetDate: "2026-03-01",
          lead: { displayName: "Alex" },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-10T00:00:00.000Z"
        },
        {
          id: "p1",
          name: "Alpha",
          state: "started",
          progress: 42,
          startDate: null,
          targetDate: null,
          lead: null,
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-09T00:00:00.000Z"
        }
      ])
    });

    const result = await listProjects(client);

    expect(result).toEqual([
      {
        id: "p1",
        name: "Alpha",
        state: "started",
        progress: 42,
        startDate: null,
        targetDate: null,
        lead: { displayName: null },
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-09T00:00:00.000Z"
      },
      {
        id: "p2",
        name: "Zeta",
        state: "planned",
        progress: 0,
        startDate: "2026-02-01",
        targetDate: "2026-03-01",
        lead: { displayName: "Alex" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-10T00:00:00.000Z"
      }
    ]);
  });
});
