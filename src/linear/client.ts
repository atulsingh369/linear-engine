import { LinearClient } from "@linear/sdk";

type SDKClient = LinearClient;
type TeamsConnection = Awaited<ReturnType<SDKClient["teams"]>>;
type ProjectsConnection = Awaited<ReturnType<SDKClient["projects"]>>;
type IssuesConnection = Awaited<ReturnType<SDKClient["issues"]>>;
type UsersConnection = Awaited<ReturnType<SDKClient["users"]>>;
type ViewerNode = Awaited<SDKClient["viewer"]>;

type CreateProjectInput = Parameters<SDKClient["createProject"]>[0];
type UpdateProjectInput = Parameters<SDKClient["updateProject"]>[1];
type UpdateProjectIdentifier = Parameters<SDKClient["updateProject"]>[0];
type CreateIssueInput = Parameters<SDKClient["createIssue"]>[0];
type UpdateIssueInput = Parameters<SDKClient["updateIssue"]>[1];
type UpdateIssueIdentifier = Parameters<SDKClient["updateIssue"]>[0];
type CreateCommentInput = Parameters<SDKClient["createComment"]>[0];

export type TeamNode = TeamsConnection["nodes"][number];
export type ProjectNode = ProjectsConnection["nodes"][number];
export type IssueNode = IssuesConnection["nodes"][number];
export type UserNode = UsersConnection["nodes"][number];

export type WorkflowStateNode = {
  id: string;
  name: string;
  type?: string;
  position?: number;
};

interface ProjectMilestoneMutation {
  success: boolean;
}

interface LinearClientWithMilestone {
  createProjectMilestone?: (input: CreateMilestoneInput) => Promise<ProjectMilestoneMutation>;
}

interface TeamWithStates {
  states: () => Promise<{ nodes: WorkflowStateNode[] }>;
}

interface LinearClientWithTeamQuery {
  team?: (teamId: string) => Promise<TeamWithStates>;
}

export interface LinearApiClientConfig {
  apiKey?: string;
}

export interface CreateMilestoneInput {
  projectId: string;
  name: string;
  description?: string;
  targetDate?: string;
  sortOrder?: number;
}

export class LinearApiClientError extends Error {
  public readonly operation: string;

  public readonly cause?: unknown;

  constructor(operation: string, message: string, cause?: unknown) {
    super(message);
    this.name = "LinearApiClientError";
    this.operation = operation;
    this.cause = cause;
  }
}

export class LinearApiClient {
  private readonly client: SDKClient;
  private currentUser: ViewerNode | null = null;

  constructor(config: LinearApiClientConfig = {}) {
    const apiKey = config.apiKey ?? process.env.LINEAR_API_KEY;
    if (!apiKey) {
      throw new LinearApiClientError(
        "initialize-client",
        "LINEAR_API_KEY is missing. Set LINEAR_API_KEY or pass apiKey in config."
      );
    }

    this.client = new LinearClient({ apiKey });
  }

  async getTeams(): Promise<TeamNode[]> {
    return this.execute("get-teams", async () => {
      const result = await this.client.teams();
      return result.nodes;
    });
  }

  async getCurrentUser(): Promise<ViewerNode> {
    return this.execute("get-current-user", async () => {
      if (this.currentUser) {
        return this.currentUser;
      }

      const viewer = await this.client.viewer;
      this.currentUser = viewer;
      return viewer;
    });
  }

  async getUsers(): Promise<UserNode[]> {
    return this.execute("get-users", async () => {
      const result = await this.client.users();
      return result.nodes;
    });
  }

  async findUserByIdentifier(identifier: string): Promise<UserNode | null> {
    return this.execute("find-user-by-identifier", async () => {
      const needle = identifier.trim();
      if (!needle) {
        throw new LinearApiClientError(
          "find-user-by-identifier",
          "User identifier is required and cannot be empty."
        );
      }

      const users = await this.getUsers();
      const byId = users.find((user) => user.id === needle);
      if (byId) {
        return byId;
      }

      const normalizedNeedle = needle.toLowerCase();
      return (
        users.find((user) => {
          const name = (user as { name?: string | null }).name ?? "";
          const displayName = (user as { displayName?: string | null }).displayName ?? "";
          const email = (user as { email?: string | null }).email ?? "";

          return (
            name.toLowerCase() === normalizedNeedle ||
            displayName.toLowerCase() === normalizedNeedle ||
            email.toLowerCase() === normalizedNeedle
          );
        }) ?? null
      );
    });
  }

  async getProjects(): Promise<ProjectNode[]> {
    return this.execute("get-projects", async () => {
      const result = await this.client.projects();
      return result.nodes;
    });
  }

  async getProjectByName(name: string): Promise<ProjectNode | null> {
    return this.execute("get-project-by-name", async () => {
      const normalizedName = name.trim();
      if (!normalizedName) {
        throw new LinearApiClientError(
          "get-project-by-name",
          "Project name is required and cannot be empty."
        );
      }

      const projects = await this.getProjects();
      return (
        projects.find(
          (project) => project.name.toLowerCase() === normalizedName.toLowerCase()
        ) ?? null
      );
    });
  }

  async getIssuesByProject(projectId: string): Promise<IssueNode[]> {
    return this.execute("get-issues-by-project", async () => {
      const normalizedProjectId = projectId.trim();
      if (!normalizedProjectId) {
        throw new LinearApiClientError(
          "get-issues-by-project",
          "Project ID is required and cannot be empty."
        );
      }

      const result = await this.client.issues({
        filter: {
          project: {
            id: {
              eq: normalizedProjectId
            }
          }
        }
      });

      return result.nodes;
    });
  }

  async getIssuesByTitle(title: string): Promise<IssueNode[]> {
    return this.execute("get-issues-by-title", async () => {
      const normalizedTitle = title.trim();
      if (!normalizedTitle) {
        throw new LinearApiClientError(
          "get-issues-by-title",
          "Issue title is required and cannot be empty."
        );
      }

      const result = await this.client.issues({
        filter: {
          title: {
            eq: normalizedTitle
          }
        }
      });

      return result.nodes;
    });
  }

  async getIssueByKey(issueKey: string): Promise<IssueNode | null> {
    return this.execute("get-issue-by-key", async () => {
      const normalizedKey = issueKey.trim();
      if (!normalizedKey) {
        throw new LinearApiClientError(
          "get-issue-by-key",
          "Issue key is required and cannot be empty."
        );
      }

      const result = await this.client.issues({
        filter: {
          identifier: {
            eq: normalizedKey
          }
        }
      });

      return result.nodes[0] ?? null;
    });
  }

  async getWorkflowStatesByTeam(teamId: string): Promise<WorkflowStateNode[]> {
    return this.execute("get-workflow-states-by-team", async () => {
      const normalizedTeamId = teamId.trim();
      if (!normalizedTeamId) {
        throw new LinearApiClientError(
          "get-workflow-states-by-team",
          "Team ID is required and cannot be empty."
        );
      }

      const teamGetter = (this.client as LinearClientWithTeamQuery).team;
      if (!teamGetter) {
        throw new LinearApiClientError(
          "get-workflow-states-by-team",
          "Current @linear/sdk version does not expose team lookup."
        );
      }

      const team = await teamGetter.call(this.client, normalizedTeamId);
      const states = await team.states();
      return states.nodes;
    });
  }

  async createProject(
    input: CreateProjectInput
  ): Promise<Awaited<ReturnType<SDKClient["createProject"]>>> {
    return this.execute("create-project", async () => this.client.createProject(input));
  }

  async updateProject(
    projectIdentifier: UpdateProjectIdentifier,
    input: UpdateProjectInput
  ): Promise<Awaited<ReturnType<SDKClient["updateProject"]>>> {
    return this.execute("update-project", async () =>
      this.client.updateProject(projectIdentifier, input)
    );
  }

  async createIssue(
    input: CreateIssueInput
  ): Promise<Awaited<ReturnType<SDKClient["createIssue"]>>> {
    return this.execute("create-issue", async () => {
      const currentUser = await this.getCurrentUser();
      return this.client.createIssue({
        ...input,
        assigneeId: input.assigneeId ?? currentUser.id
      });
    });
  }

  async updateIssue(
    issueIdentifier: UpdateIssueIdentifier,
    input: UpdateIssueInput
  ): Promise<Awaited<ReturnType<SDKClient["updateIssue"]>>> {
    return this.execute("update-issue", async () =>
      this.client.updateIssue(issueIdentifier, input)
    );
  }

  async createComment(
    input: CreateCommentInput
  ): Promise<Awaited<ReturnType<SDKClient["createComment"]>>> {
    return this.execute("create-comment", async () => this.client.createComment(input));
  }

  async createMilestone(input: CreateMilestoneInput): Promise<ProjectMilestoneMutation> {
    return this.execute("create-milestone", async () => {
      const milestoneCreator = (this.client as LinearClientWithMilestone).createProjectMilestone;
      if (!milestoneCreator) {
        throw new LinearApiClientError(
          "create-milestone",
          "Current @linear/sdk version does not expose createProjectMilestone."
        );
      }

      return milestoneCreator.call(this.client, input);
    });
  }

  private async execute<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof LinearApiClientError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      throw new LinearApiClientError(
        operation,
        `Linear API operation failed (${operation}): ${message}`,
        error
      );
    }
  }
}

export function createLinearApiClient(config: LinearApiClientConfig = {}): LinearApiClient {
  return new LinearApiClient(config);
}
