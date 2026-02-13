import { describe, expect, it, vi } from "vitest";
import { assignProjectIssues } from "./project";
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
