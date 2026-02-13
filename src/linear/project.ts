import { createLinearApiClient, LinearApiClient } from "./client";

type ProjectLike = {
  id: string;
};

type IssueLike = {
  id: string;
  identifier?: string | null;
  title?: string;
  stateId?: string | null;
  teamId?: string | null;
  projectMilestoneId?: string | null;
  createdAt?: Date | string;
  parentId?: string | null;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    displayName?: string | null;
  } | null;
};

export interface AssignProjectIssuesInput {
  projectName: string;
  force?: boolean;
}

export interface AssignProjectIssuesResult {
  totalIssues: number;
  assignedCount: number;
  skippedCount: number;
}

export interface ListProjectIssuesInput {
  projectName: string;
}

export interface ListedProjectIssue {
  id: string;
  identifier: string | null;
  title: string;
  state: {
    name: string | null;
  };
  projectMilestoneId: string | null;
  createdAt: string;
  parentId: string | null;
  assignee: {
    displayName: string | null;
  };
}

export async function assignProjectIssues(
  input: AssignProjectIssuesInput,
  client: LinearApiClient = createLinearApiClient(),
): Promise<AssignProjectIssuesResult> {
  const projectName = input.projectName.trim();
  if (!projectName) {
    throw new Error("Project name is required.");
  }

  const project = (await client.getProjectByName(
    projectName,
  )) as ProjectLike | null;
  if (!project) {
    throw new Error(`Project not found: ${projectName}`);
  }

  const currentUser = await client.getCurrentUser();
  const issues = (await client.getIssuesByProject(project.id)) as IssueLike[];
  const force = input.force ?? false;

  let assignedCount = 0;
  let skippedCount = 0;

  for (const issue of issues) {
    const hasAssignee = getIssueAssigneeId(issue) !== null;

    if (!force && hasAssignee) {
      skippedCount += 1;
      continue;
    }

    await client.updateIssue(issue.id, { assigneeId: currentUser.id });
    assignedCount += 1;
  }

  return {
    totalIssues: issues.length,
    assignedCount,
    skippedCount,
  };
}

export async function listProjectIssues(
  input: ListProjectIssuesInput,
  client: LinearApiClient = createLinearApiClient(),
): Promise<ListedProjectIssue[]> {
  const projectName = input.projectName.trim();
  if (!projectName) {
    throw new Error("Project name is required.");
  }

  const project = (await client.getProjectByName(
    projectName,
  )) as ProjectLike | null;
  if (!project) {
    throw new Error(`Project not found: ${projectName}`);
  }

  const issues = (await client.getIssuesByProject(project.id)) as IssueLike[];
  const stateMapsByTeam = await getStateNameMapsByTeam(issues, client);

  const mapped = issues
    .map((issue) => {
      const stateName =
        issue.teamId && issue.stateId
          ? (stateMapsByTeam.get(issue.teamId)?.get(issue.stateId) ?? null)
          : null;

      return {
        id: issue.id,
        identifier: issue.identifier ?? null,
        title: issue.title ?? "",
        state: {
          name: stateName,
        },
        projectMilestoneId: issue.projectMilestoneId ?? null,
        createdAt: issue.createdAt ? String(issue.createdAt) : "",
        parentId: issue.parentId ?? null,
        assignee: {
          displayName: issue.assignee?.displayName ?? null,
        },
      } satisfies ListedProjectIssue;
    })
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return String(a.createdAt).localeCompare(String(b.createdAt));
      }

      return a.id.localeCompare(b.id);
    });

  return mapped;
}

function getIssueAssigneeId(issue: IssueLike): string | null {
  if (issue.assigneeId) {
    return issue.assigneeId;
  }

  return issue.assignee?.id ?? null;
}

async function getStateNameMapsByTeam(
  issues: IssueLike[],
  client: LinearApiClient,
): Promise<Map<string, Map<string, string>>> {
  const teamIds = Array.from(
    new Set(
      issues
        .map((issue) => issue.teamId)
        .filter((teamId): teamId is string => Boolean(teamId)),
    ),
  );

  const stateMapsByTeam = new Map<string, Map<string, string>>();
  for (const teamId of teamIds) {
    const states = await client.getWorkflowStatesByTeam(teamId);
    stateMapsByTeam.set(
      teamId,
      new Map(states.map((state) => [state.id, state.name])),
    );
  }

  return stateMapsByTeam;
}
