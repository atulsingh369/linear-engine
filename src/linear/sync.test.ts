import { describe, expect, it, vi } from "vitest";
import { syncProject } from "./sync";
import { LinearApiClient } from "./client";
import { ProjectSpec } from "./types";

function createMockClient(overrides: Record<string, unknown> = {}): LinearApiClient {
  const base = {
    getProjectByName: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    getIssuesByProject: vi.fn(),
    getCurrentUser: vi.fn(),
    getTeams: vi.fn(),
    createIssue: vi.fn(),
    updateIssue: vi.fn(),
    createMilestone: vi.fn(),
    findUserByIdentifier: vi.fn(),
    getIssueByKey: vi.fn()
  };

  return { ...base, ...overrides } as unknown as LinearApiClient;
}

describe("syncProject", () => {
  it("creates issues with metadata header and assignee from assignee reference", async () => {
    const createIssue = vi.fn().mockResolvedValue({
      issue: { id: "i1", title: "Epic A", teamId: "t1" }
    });

    const client = createMockClient({
      getProjectByName: vi.fn().mockResolvedValue(null),
      createProject: vi.fn().mockResolvedValue({
        project: { id: "p1", name: "Engine", teamId: "t1" }
      }),
      getIssuesByProject: vi.fn().mockResolvedValue([]),
      getCurrentUser: vi.fn().mockResolvedValue({ id: "u1" }),
      findUserByIdentifier: vi.fn().mockResolvedValue(null),
      getIssueByKey: vi.fn().mockImplementation(async (key: string) => {
        if (key === "COG-99") {
          return { id: "i99", assigneeId: "u9" };
        }
        return null;
      }),
      createIssue
    });

    const spec: ProjectSpec = {
      project: { name: "Engine", description: "desc" },
      epics: [{ title: "Epic A", description: "Build it", assignee: "COG-99" }]
    };

    await syncProject(spec, client);

    expect(createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeId: "u9",
        description: expect.stringMatching(/^managedBy: linear-engine\n\n/)
      })
    );
  });

  it("does not overwrite existing assignee without explicit assignee in spec", async () => {
    const updateIssue = vi.fn().mockResolvedValue({ success: true });
    const client = createMockClient({
      getProjectByName: vi.fn().mockResolvedValue({ id: "p1", name: "Engine", teamId: "t1" }),
      getIssuesByProject: vi.fn().mockResolvedValue([
        {
          id: "i1",
          title: "Epic A",
          parentId: null,
          assigneeId: "u-existing",
          description: "managedBy: linear-engine\n\nBuild it"
        }
      ]),
      getCurrentUser: vi.fn().mockResolvedValue({ id: "u1" }),
      updateIssue
    });

    const spec: ProjectSpec = {
      project: { name: "Engine", description: "desc" },
      epics: [{ title: "Epic A", description: "Build it" }]
    };

    await syncProject(spec, client);

    const assigneeUpdates = updateIssue.mock.calls.filter(
      (call) => call[1] && Object.prototype.hasOwnProperty.call(call[1], "assigneeId")
    );
    expect(assigneeUpdates).toHaveLength(0);
  });
});
