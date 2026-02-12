import { LinearClient } from "@linear/sdk";

type SDKClient = LinearClient;
type TeamsConnection = Awaited<ReturnType<SDKClient["teams"]>>;
type ProjectsConnection = Awaited<ReturnType<SDKClient["projects"]>>;
type IssuesConnection = Awaited<ReturnType<SDKClient["issues"]>>;
type TeamNode = TeamsConnection["nodes"][number];
type ProjectNode = ProjectsConnection["nodes"][number];
type IssueNode = IssuesConnection["nodes"][number];
type CreateProjectInput = Parameters<SDKClient["createProject"]>[0];
type CreateIssueInput = Parameters<SDKClient["createIssue"]>[0];
type UpdateIssueInput = Parameters<SDKClient["updateIssue"]>[1];
type UpdateIssueIdentifier = Parameters<SDKClient["updateIssue"]>[0];

interface ProjectMilestoneMutation {
  success: boolean;
}

interface LinearClientWithMilestone {
  createProjectMilestone?: (input: CreateMilestoneInput) => Promise<ProjectMilestoneMutation>;
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
      if (!projectId.trim()) {
        throw new LinearApiClientError(
          "get-issues-by-project",
          "Project ID is required and cannot be empty."
        );
      }

      const result = await this.client.issues({
        filter: {
          project: {
            id: {
              eq: projectId
            }
          }
        }
      });

      return result.nodes;
    });
  }

  async createProject(input: CreateProjectInput): Promise<Awaited<ReturnType<SDKClient["createProject"]>>> {
    return this.execute("create-project", async () => this.client.createProject(input));
  }

  async createIssue(input: CreateIssueInput): Promise<Awaited<ReturnType<SDKClient["createIssue"]>>> {
    return this.execute("create-issue", async () => this.client.createIssue(input));
  }

  async updateIssue(
    issueIdentifier: UpdateIssueIdentifier,
    input: UpdateIssueInput
  ): Promise<Awaited<ReturnType<SDKClient["updateIssue"]>>> {
    return this.execute("update-issue", async () =>
      this.client.updateIssue(issueIdentifier, input)
    );
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
