import { describe, expect, it, vi } from "vitest";
import {
  addCommentToIssue,
  assignIssueToUser,
  getIssueStatusByKey,
  moveIssueByKeyToState,
  startIssueByKey
} from "./issue";
import { LinearApiClient } from "./client";

function createMockClient(overrides: Record<string, unknown> = {}): LinearApiClient {
  const base = {
    getIssueByKey: vi.fn(),
    getWorkflowStatesByTeam: vi.fn(),
    getProjects: vi.fn(),
    updateIssue: vi.fn(),
    createComment: vi.fn(),
    findUserByIdentifier: vi.fn()
  };

  return { ...base, ...overrides } as unknown as LinearApiClient;
}

describe("issue helpers", () => {
  it("returns issue status payload", async () => {
    const client = createMockClient({
      getIssueByKey: vi.fn().mockResolvedValue({
        id: "i1",
        identifier: "COG-12",
        title: "Implement API",
        teamId: "t1",
        stateId: "s2",
        projectId: "p1",
        assignee: { id: "u1", displayName: "Atul" }
      }),
      getWorkflowStatesByTeam: vi.fn().mockResolvedValue([
        { id: "s1", name: "Todo" },
        { id: "s2", name: "In Progress" }
      ]),
      getProjects: vi.fn().mockResolvedValue([{ id: "p1", name: "Engine" }])
    });

    const result = await getIssueStatusByKey("COG-12", client);

    expect(result).toEqual({
      issueKey: "COG-12",
      title: "Implement API",
      state: "In Progress",
      assignee: "Atul",
      project: "Engine"
    });
  });

  it("moves issue by key", async () => {
    const updateIssue = vi.fn().mockResolvedValue({ success: true });
    const client = createMockClient({
      getIssueByKey: vi.fn().mockResolvedValue({
        id: "i1",
        identifier: "COG-12",
        teamId: "t1",
        stateId: "s1"
      }),
      getWorkflowStatesByTeam: vi.fn().mockResolvedValue([
        { id: "s1", name: "Todo" },
        { id: "s2", name: "In Progress" }
      ]),
      updateIssue
    });

    const result = await moveIssueByKeyToState(
      { issueKey: "COG-12", stateName: "in progress" },
      client
    );

    expect(result).toEqual({
      issueKey: "COG-12",
      previousState: "Todo",
      newState: "In Progress"
    });
    expect(updateIssue).toHaveBeenCalledWith("i1", { stateId: "s2" });
  });

  it("adds comment to issue", async () => {
    const createComment = vi.fn().mockResolvedValue({ success: true });
    const client = createMockClient({
      getIssueByKey: vi.fn().mockResolvedValue({ id: "i1", identifier: "COG-12" }),
      createComment
    });

    await addCommentToIssue({ issueKey: "COG-12", text: "Looks good" }, client);

    expect(createComment).toHaveBeenCalledWith({ issueId: "i1", body: "Looks good" });
  });

  it("assigns issue to user by identifier", async () => {
    const updateIssue = vi.fn().mockResolvedValue({ success: true });
    const client = createMockClient({
      getIssueByKey: vi.fn().mockResolvedValue({ id: "i1", identifier: "COG-12" }),
      findUserByIdentifier: vi.fn().mockResolvedValue({ id: "u1", displayName: "Atul" }),
      updateIssue
    });

    const result = await assignIssueToUser(
      { issueKey: "COG-12", userIdentifier: "atul" },
      client
    );

    expect(result.assignee).toBe("Atul");
    expect(updateIssue).toHaveBeenCalledWith("i1", { assigneeId: "u1" });
  });

  it("starts issue in first active state", async () => {
    const updateIssue = vi.fn().mockResolvedValue({ success: true });
    const client = createMockClient({
      getIssueByKey: vi.fn().mockResolvedValue({
        id: "i1",
        identifier: "COG-12",
        teamId: "t1",
        stateId: "s1"
      }),
      getWorkflowStatesByTeam: vi.fn().mockResolvedValue([
        { id: "s1", name: "Todo", type: "unstarted", position: 1 },
        { id: "s2", name: "In Progress", type: "started", position: 2 }
      ]),
      updateIssue
    });

    const result = await startIssueByKey("COG-12", client);

    expect(result.newState).toBe("In Progress");
    expect(updateIssue).toHaveBeenCalledWith("i1", { stateId: "s2" });
  });
});
