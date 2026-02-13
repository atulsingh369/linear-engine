import { createLinearApiClient, LinearApiClient } from "./client";

type ProjectLike = {
  id: string;
};

type IssueLike = {
  id: string;
  assigneeId?: string | null;
  assignee?: {
    id: string;
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

export async function assignProjectIssues(
  input: AssignProjectIssuesInput,
  client: LinearApiClient = createLinearApiClient()
): Promise<AssignProjectIssuesResult> {
  const projectName = input.projectName.trim();
  if (!projectName) {
    throw new Error("Project name is required.");
  }

  const project = (await client.getProjectByName(projectName)) as ProjectLike | null;
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
    skippedCount
  };
}

function getIssueAssigneeId(issue: IssueLike): string | null {
  if (issue.assigneeId) {
    return issue.assigneeId;
  }

  return issue.assignee?.id ?? null;
}
