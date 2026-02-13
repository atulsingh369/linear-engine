import { createLinearApiClient, LinearApiClient, WorkflowStateNode } from "./client";
import { findStateByName, getFirstActiveState, getStateNameById } from "./workflow";

type IssueLike = {
  id: string;
  title: string;
  identifier?: string | null;
  teamId?: string | null;
  stateId?: string | null;
  projectId?: string | null;
  description?: string | null;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    name?: string | null;
    displayName?: string | null;
    email?: string | null;
  } | null;
};

type ProjectLike = {
  id: string;
  name: string;
};

export interface MoveIssueInput {
  title: string;
  stateName: string;
}

export interface MoveIssueByKeyInput {
  issueKey: string;
  stateName: string;
}

export interface MoveIssueResult {
  issueKey: string;
  previousState: string;
  newState: string;
}

export interface IssueStatus {
  issueKey: string;
  title: string;
  state: string;
  assignee: string;
  project: string;
}

export interface CommentIssueInput {
  issueKey: string;
  text: string;
}

export interface AssignIssueInput {
  issueKey: string;
  userIdentifier: string;
}

export interface AssignIssueResult {
  issueKey: string;
  assignee: string;
}

export interface StartIssueResult {
  issueKey: string;
  previousState: string;
  newState: string;
}

export async function getIssueStatusByKey(
  issueKey: string,
  client: LinearApiClient = createLinearApiClient()
): Promise<IssueStatus> {
  const issue = await getRequiredIssueByKey(issueKey, client);
  if (!issue.teamId) {
    throw new Error(`Issue "${issue.identifier ?? issueKey}" has no team and cannot resolve status.`);
  }

  const states = await client.getWorkflowStatesByTeam(issue.teamId);
  const projects = (await client.getProjects()) as ProjectLike[];
  const users = await client.getUsers();
  const projectName = resolveProjectName(issue, projects);

  return {
    issueKey: issue.identifier ?? issueKey,
    title: issue.title,
    state: getStateNameById(states, issue.stateId),
    assignee: resolveAssigneeLabel(issue, users),
    project: projectName
  };
}

export async function moveIssueToState(
  input: MoveIssueInput,
  client: LinearApiClient = createLinearApiClient()
): Promise<MoveIssueResult> {
  const title = input.title.trim();
  const stateName = input.stateName.trim();

  if (!title) {
    throw new Error("Issue title is required.");
  }

  const issues = (await client.getIssuesByTitle(title)) as IssueLike[];
  const exactMatches = issues.filter((issue) => issue.title === title);
  if (exactMatches.length === 0) {
    throw new Error(`Issue not found: ${title}`);
  }
  if (exactMatches.length > 1) {
    throw new Error(`Multiple issues found with title: ${title}`);
  }

  return moveIssueToStateInternal(exactMatches[0], stateName, client, title);
}

export async function moveIssueByKeyToState(
  input: MoveIssueByKeyInput,
  client: LinearApiClient = createLinearApiClient()
): Promise<MoveIssueResult> {
  const issue = await getRequiredIssueByKey(input.issueKey, client);
  return moveIssueToStateInternal(input.issueKey, input.stateName, client, issue.identifier ?? input.issueKey, issue);
}

export async function addCommentToIssue(
  input: CommentIssueInput,
  client: LinearApiClient = createLinearApiClient()
): Promise<{ issueKey: string }> {
  const issue = await getRequiredIssueByKey(input.issueKey, client);
  const text = input.text.trim();
  if (!text) {
    throw new Error("Comment text is required.");
  }

  await client.createComment({
    issueId: issue.id,
    body: text
  });

  return { issueKey: issue.identifier ?? input.issueKey };
}

export async function assignIssueToUser(
  input: AssignIssueInput,
  client: LinearApiClient = createLinearApiClient()
): Promise<AssignIssueResult> {
  const issue = await getRequiredIssueByKey(input.issueKey, client);
  const userIdentifier = input.userIdentifier.trim();
  if (!userIdentifier) {
    throw new Error("User identifier is required.");
  }

  const user = await client.findUserByIdentifier(userIdentifier);
  if (!user) {
    throw new Error(`User not found: ${userIdentifier}`);
  }

  await client.updateIssue(issue.id, { assigneeId: user.id });

  return {
    issueKey: issue.identifier ?? input.issueKey,
    assignee: resolveUserLabel(user)
  };
}

export async function startIssueByKey(
  issueKey: string,
  client: LinearApiClient = createLinearApiClient()
): Promise<StartIssueResult> {
  const issue = await getRequiredIssueByKey(issueKey, client);
  if (!issue.teamId) {
    throw new Error(`Issue "${issue.identifier ?? issueKey}" has no team and cannot be started.`);
  }

  const states = await client.getWorkflowStatesByTeam(issue.teamId);
  const nextState = getFirstActiveState(states);
  if (!nextState) {
    throw new Error("No active workflow state found for issue team.");
  }

  const previousState = getStateNameById(states, issue.stateId);
  if (issue.stateId !== nextState.id) {
    await client.updateIssue(issue.id, { stateId: nextState.id });
  }

  return {
    issueKey: issue.identifier ?? issueKey,
    previousState,
    newState: nextState.name
  };
}

async function moveIssueToStateInternal(
  issueOrKey: IssueLike | string,
  stateNameInput: string,
  client: LinearApiClient,
  fallbackIssueKey: string,
  issueFromLookup?: IssueLike
): Promise<MoveIssueResult> {
  const stateName = stateNameInput.trim();
  if (!stateName) {
    throw new Error("State name is required.");
  }

  const issue =
    typeof issueOrKey === "string"
      ? issueFromLookup ?? (await getRequiredIssueByKey(issueOrKey, client))
      : issueOrKey;

  if (!issue.teamId) {
    throw new Error(`Issue "${issue.identifier ?? fallbackIssueKey}" has no team and cannot be moved.`);
  }

  const states = (await client.getWorkflowStatesByTeam(issue.teamId)) as WorkflowStateNode[];
  const targetState = findStateByName(states, stateName);
  if (!targetState) {
    throw new Error(`State not found in team workflow: ${stateName}`);
  }

  const previousState = getStateNameById(states, issue.stateId);
  if (issue.stateId !== targetState.id) {
    await client.updateIssue(issue.id, { stateId: targetState.id });
  }

  return {
    issueKey: issue.identifier ?? fallbackIssueKey,
    previousState,
    newState: targetState.name
  };
}

async function getRequiredIssueByKey(
  issueKeyInput: string,
  client: LinearApiClient
): Promise<IssueLike> {
  const issueKey = issueKeyInput.trim();
  if (!issueKey) {
    throw new Error("Issue key is required.");
  }

  const issue = (await client.getIssueByKey(issueKey)) as IssueLike | null;
  if (!issue) {
    throw new Error(`Issue not found: ${issueKey}`);
  }

  return issue;
}

function resolveProjectName(issue: IssueLike, projects: ProjectLike[]): string {
  if (issue.projectId) {
    const byId = projects.find((project) => project.id === issue.projectId);
    if (byId) {
      return byId.name;
    }
  }

  return "Unknown";
}

function resolveAssigneeLabel(
  issue: IssueLike,
  users: Array<{ id: string; displayName?: string | null; name?: string | null; email?: string | null }>
): string {
  const assigneeId = issue.assigneeId ?? issue.assignee?.id ?? null;
  if (!assigneeId) {
    return "Unassigned";
  }

  const user = users.find((candidate) => candidate.id === assigneeId);
  if (!user) {
    return assigneeId;
  }

  return resolveUserLabel(user);
}

function resolveUserLabel(user: { id: string; displayName?: string | null; name?: string | null; email?: string | null }): string {
  const displayName = user.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const name = user.name?.trim();
  if (name) {
    return name;
  }

  const email = user.email?.trim();
  if (email) {
    return email;
  }

  return user.id;
}
