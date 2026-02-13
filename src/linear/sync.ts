import { createLinearApiClient, LinearApiClient } from "./client";
import { EpicSpec, ProjectSpec } from "./types";

const MANAGED_METADATA_LINE = "managedBy: linear-engine";

export type SyncStatus = "Created" | "Updated" | "Skipped";
export type SyncEntity =
  | "project"
  | "milestone"
  | "epic"
  | "story"
  | "milestone-assignment";

export interface SyncAction {
  status: SyncStatus;
  entity: SyncEntity;
  name: string;
  reason?: string;
}

export interface SyncReport {
  actions: SyncAction[];
}

type ProjectLike = {
  id: string;
  name: string;
  description?: string | null;
  teamId?: string | null;
  teamIds?: string[] | null;
  projectMilestones?: () => Promise<{ nodes: MilestoneLike[] }>;
  teams?: () => Promise<{ nodes: Array<{ id: string }> }>;
};

type MilestoneLike = {
  id: string;
  name: string;
};

type IssueLike = {
  id: string;
  title: string;
  description?: string | null;
  teamId?: string | null;
  parentId?: string | null;
  projectMilestoneId?: string | null;
  assigneeId?: string | null;
  assignee?: {
    id: string;
  } | null;
};

export interface SyncOptions {
  dryRun?: boolean;
}

export async function runLinearSync(_options: SyncOptions = {}): Promise<void> {
  // Intentionally left minimal for now.
}

export async function syncProject(
  spec: ProjectSpec,
  client: LinearApiClient = createLinearApiClient()
): Promise<SyncReport> {
  const report: SyncReport = { actions: [] };

  const project = await ensureProject(client, spec, report);
  await ensureMilestones(client, project, spec, report);
  await ensureEpicsAndStories(client, project, spec, report);

  return report;
}

async function ensureProject(
  client: LinearApiClient,
  spec: ProjectSpec,
  report: SyncReport
): Promise<ProjectLike> {
  const projectName = spec.project.name.trim();
  if (!projectName) {
    throw new Error("Project name is required.");
  }

  const desiredDescription = spec.project.description ?? "";
  const existingProject = (await client.getProjectByName(projectName)) as ProjectLike | null;

  if (!existingProject) {
    const createResult = await client.createProject({
      name: projectName,
      description: desiredDescription
    });
    const createdProject = (createResult as { project?: ProjectLike }).project;
    if (!createdProject) {
      throw new Error(`Failed to create project \"${projectName}\".`);
    }

    pushAction(report, "Created", "project", projectName);
    return createdProject;
  }

  const currentDescription = existingProject.description ?? "";
  if (currentDescription !== desiredDescription) {
    await client.updateProject(existingProject.id, {
      description: desiredDescription
    });
    pushAction(report, "Updated", "project", projectName);
  } else {
    pushAction(report, "Skipped", "project", projectName, "description unchanged");
  }

  return existingProject;
}

async function ensureMilestones(
  client: LinearApiClient,
  project: ProjectLike,
  spec: ProjectSpec,
  report: SyncReport
): Promise<void> {
  const desiredMilestoneNames = collectDesiredMilestoneNames(spec);
  if (desiredMilestoneNames.size === 0) {
    return;
  }

  const existingMilestones = await getProjectMilestones(project, desiredMilestoneNames.size > 0);
  const existingNames = new Set(existingMilestones.map((milestone) => milestone.name));

  for (const milestoneName of desiredMilestoneNames) {
    if (!existingNames.has(milestoneName)) {
      await client.createMilestone({
        projectId: project.id,
        name: milestoneName
      });
      pushAction(report, "Created", "milestone", milestoneName);
      continue;
    }

    pushAction(report, "Skipped", "milestone", milestoneName, "already exists");
  }

  const resolvedMilestones = await getProjectMilestones(project, desiredMilestoneNames.size > 0);
  const resolvedMilestoneNames = new Set(resolvedMilestones.map((milestone) => milestone.name));
  for (const milestoneName of desiredMilestoneNames) {
    if (!resolvedMilestoneNames.has(milestoneName)) {
      throw new Error(`Milestone exists in spec but could not be resolved: ${milestoneName}`);
    }
  }
}

async function ensureEpicsAndStories(
  client: LinearApiClient,
  project: ProjectLike,
  spec: ProjectSpec,
  report: SyncReport
): Promise<void> {
  const desiredEpics = spec.epics ?? [];
  if (desiredEpics.length === 0) {
    return;
  }

  const issues = (await client.getIssuesByProject(project.id)) as IssueLike[];
  const currentUser = await client.getCurrentUser();
  const teamId = await resolveTeamId(client, project, issues);

  for (const epicSpec of desiredEpics) {
    const desiredEpicAssigneeId = await resolveDesiredAssigneeId(
      client,
      epicSpec.assignee,
      currentUser.id
    );

    const epicMilestoneName = resolveEpicMilestoneName(spec, epicSpec);

    let epicIssue = findIssueByTitle(issues, epicSpec.title, null);

    if (!epicIssue) {
      const createdEpic = await client.createIssue({
        teamId,
        projectId: project.id,
        title: epicSpec.title,
        description: ensureManagedMetadata(epicSpec.description),
        assigneeId: desiredEpicAssigneeId
      });
      epicIssue = (createdEpic as { issue?: IssueLike }).issue ?? null;
      if (!epicIssue) {
        throw new Error(`Failed to create epic \"${epicSpec.title}\".`);
      }

      issues.push(epicIssue);
      pushAction(report, "Created", "epic", epicSpec.title);
    } else {
      await syncIssueAssignee(
        client,
        epicIssue,
        desiredEpicAssigneeId,
        Boolean(epicSpec.assignee),
        report,
        "epic",
        epicSpec.title
      );

      const desiredEpicDescription = ensureManagedMetadata(epicSpec.description);
      if (normalizeDescription(epicIssue.description) !== normalizeDescription(desiredEpicDescription)) {
        await client.updateIssue(epicIssue.id, {
          description: desiredEpicDescription
        });
        epicIssue.description = desiredEpicDescription;
        pushAction(report, "Updated", "epic", epicSpec.title, "description synchronized");
      } else {
        pushAction(report, "Skipped", "epic", epicSpec.title, "description unchanged");
      }
    }

    if (epicMilestoneName) {
      const assigned = await attachIssueToMilestone(
        client,
        epicIssue.id,
        project.id,
        epicMilestoneName
      );
      if (assigned) {
        pushAction(report, "Updated", "epic", epicSpec.title, "milestone assigned");
        pushAction(
          report,
          "Updated",
          "milestone-assignment",
          epicSpec.title,
          `milestone assigned: ${epicMilestoneName}`
        );
      }
    }

    const desiredStories = epicSpec.stories ?? [];
    for (const storySpec of desiredStories) {
      const storyMilestoneName = resolveStoryMilestoneName(epicSpec.milestone, storySpec.milestone);

      const desiredStoryAssigneeId = await resolveDesiredAssigneeId(
        client,
        storySpec.assignee,
        currentUser.id
      );

      let storyIssue = findIssueByTitle(issues, storySpec.title, epicIssue.id);

      if (!storyIssue) {
        const createdStory = await client.createIssue({
          teamId,
          projectId: project.id,
          parentId: epicIssue.id,
          title: storySpec.title,
          description: ensureManagedMetadata(storySpec.description),
          assigneeId: desiredStoryAssigneeId
        });
        storyIssue = (createdStory as { issue?: IssueLike }).issue ?? null;
        if (!storyIssue) {
          throw new Error(`Failed to create story \"${storySpec.title}\".`);
        }

        issues.push(storyIssue);
        pushAction(report, "Created", "story", storySpec.title);
      } else {
        await syncIssueAssignee(
          client,
          storyIssue,
          desiredStoryAssigneeId,
          Boolean(storySpec.assignee),
          report,
          "story",
          storySpec.title
        );

        const desiredStoryDescription = ensureManagedMetadata(storySpec.description);
        if (
          normalizeDescription(storyIssue.description) !==
          normalizeDescription(desiredStoryDescription)
        ) {
          await client.updateIssue(storyIssue.id, {
            description: desiredStoryDescription
          });
          storyIssue.description = desiredStoryDescription;
          pushAction(report, "Updated", "story", storySpec.title, "description synchronized");
        } else {
          pushAction(report, "Skipped", "story", storySpec.title, "description unchanged");
        }
      }

      if (storyMilestoneName) {
        const assigned = await attachIssueToMilestone(
          client,
          storyIssue.id,
          project.id,
          storyMilestoneName
        );
        if (assigned) {
          pushAction(report, "Updated", "story", storySpec.title, "milestone assigned");
          pushAction(
            report,
            "Updated",
            "milestone-assignment",
            storySpec.title,
            `milestone assigned: ${storyMilestoneName}`
          );
        }
      }
    }
  }
}

async function syncIssueAssignee(
  client: LinearApiClient,
  issue: IssueLike,
  desiredAssigneeId: string,
  explicitAssigneeInSpec: boolean,
  report: SyncReport,
  entity: SyncEntity,
  name: string
): Promise<void> {
  const currentAssigneeId = getIssueAssigneeId(issue);

  if (explicitAssigneeInSpec) {
    if (currentAssigneeId !== desiredAssigneeId) {
      await client.updateIssue(issue.id, { assigneeId: desiredAssigneeId });
      issue.assigneeId = desiredAssigneeId;
      pushAction(report, "Updated", entity, name, "assignee set from spec");
    }
    return;
  }

  if (currentAssigneeId === null) {
    await client.updateIssue(issue.id, { assigneeId: desiredAssigneeId });
    issue.assigneeId = desiredAssigneeId;
    pushAction(report, "Updated", entity, name, "Assigned issue to current user");
  }
}

async function resolveDesiredAssigneeId(
  client: LinearApiClient,
  assigneeReference: string | undefined,
  defaultAssigneeId: string
): Promise<string> {
  if (!assigneeReference) {
    return defaultAssigneeId;
  }

  const normalizedReference = assigneeReference.trim();
  if (!normalizedReference) {
    return defaultAssigneeId;
  }

  const user = await client.findUserByIdentifier(normalizedReference);
  if (user) {
    return user.id;
  }

  const issue = await client.getIssueByKey(normalizedReference);
  if (issue) {
    const issueAssigneeId = getIssueAssigneeId(issue as IssueLike);
    if (issueAssigneeId) {
      return issueAssigneeId;
    }

    throw new Error(
      `Assignee reference ${normalizedReference} points to an issue without an assignee.`
    );
  }

  throw new Error(`Unable to resolve assignee reference: ${normalizedReference}`);
}

function getIssueAssigneeId(issue: { assigneeId?: string | null; assignee?: { id: string } | null }): string | null {
  if (issue.assigneeId) {
    return issue.assigneeId;
  }

  return issue.assignee?.id ?? null;
}

function findIssueByTitle(
  issues: IssueLike[],
  title: string,
  parentId: string | null
): IssueLike | null {
  return (
    issues.find(
      (issue) => issue.title === title && normalizeParentId(issue.parentId) === parentId
    ) ?? null
  );
}

function normalizeParentId(parentId: string | null | undefined): string | null {
  return parentId ?? null;
}

async function getProjectMilestones(
  project: ProjectLike,
  required: boolean
): Promise<MilestoneLike[]> {
  if (typeof project.projectMilestones !== "function") {
    if (required) {
      throw new Error("Unable to query project milestones for this project.");
    }

    return [];
  }

  const result = await project.projectMilestones();
  return result.nodes;
}

async function resolveTeamId(
  client: LinearApiClient,
  project: ProjectLike,
  issues: IssueLike[]
): Promise<string> {
  if (project.teamId) {
    return project.teamId;
  }

  if (project.teamIds && project.teamIds.length > 0) {
    return project.teamIds[0];
  }

  const issueTeamId = issues.find((issue) => Boolean(issue.teamId))?.teamId;
  if (issueTeamId) {
    return issueTeamId;
  }

  if (typeof project.teams === "function") {
    const teams = await project.teams();
    if (teams.nodes.length > 0) {
      return teams.nodes[0].id;
    }
  }

  const allTeams = await client.getTeams();
  if (allTeams.length > 0) {
    return allTeams[0].id;
  }

  throw new Error("Unable to resolve teamId for creating issues.");
}

function ensureManagedMetadata(description: string): string {
  const stripped = stripManagedMetadata(description);
  if (!stripped) {
    return MANAGED_METADATA_LINE;
  }

  return `${MANAGED_METADATA_LINE}\n\n${stripped}`;
}

function collectDesiredMilestoneNames(spec: ProjectSpec): Set<string> {
  const names = new Set<string>();

  for (const milestone of spec.milestones ?? []) {
    if (milestone.name.trim()) {
      names.add(milestone.name.trim());
    }
  }

  for (const epic of spec.epics ?? []) {
    const epicMilestoneName = resolveEpicMilestoneName(spec, epic);
    if (epicMilestoneName) {
      names.add(epicMilestoneName);
    }

    for (const story of epic.stories ?? []) {
      const storyMilestoneName = resolveStoryMilestoneName(epic.milestone, story.milestone);
      if (storyMilestoneName) {
        names.add(storyMilestoneName);
      }
    }
  }

  return names;
}

function resolveEpicMilestoneName(spec: ProjectSpec, epic: EpicSpec): string | undefined {
  const explicitName = epic.milestone?.trim();
  if (explicitName) {
    return explicitName;
  }

  const matchingTopLevel = spec.milestones?.find(
    (milestone) => milestone.name.trim() === epic.title.trim()
  );
  if (matchingTopLevel?.name.trim()) {
    return matchingTopLevel.name.trim();
  }

  return undefined;
}

function resolveStoryMilestoneName(
  epicMilestone: string | undefined,
  storyMilestone: string | undefined
): string | undefined {
  const explicitStory = storyMilestone?.trim();
  if (explicitStory) {
    return explicitStory;
  }

  const inheritedEpic = epicMilestone?.trim();
  if (inheritedEpic) {
    return inheritedEpic;
  }

  return undefined;
}

async function attachIssueToMilestone(
  client: LinearApiClient,
  issueId: string,
  projectId: string,
  milestoneName: string
): Promise<boolean> {
  const normalizedName = milestoneName.trim();
  if (!normalizedName) {
    return false;
  }

  const project = (await client.getProjects()).find((candidate) => candidate.id === projectId) as
    | (ProjectLike & { projectMilestones?: () => Promise<{ nodes: MilestoneLike[] }> })
    | undefined;
  if (!project || typeof project.projectMilestones !== "function") {
    return false;
  }

  const milestoneResult = await project.projectMilestones();
  const foundMilestone = milestoneResult.nodes.find(
    (milestone) => milestone.name === normalizedName
  );
  if (!foundMilestone) {
    return false;
  }

  await client.updateIssue(issueId, { projectMilestoneId: foundMilestone.id });
  return true;
}

function stripManagedMetadata(description: string | null | undefined): string {
  if (!description) {
    return "";
  }

  return description
    .replace(/\s*^---\s*\nmanagedBy:\s*linear-engine\s*\n---\s*\n?/imu, "")
    .replace(/\s*\n?---\s*\nmanagedBy:\s*linear-engine\s*\n---\s*$/imu, "")
    .replace(/^managedBy:\s*linear-engine\s*\n*/imu, "")
    .trim();
}

function normalizeDescription(description: string | null | undefined): string {
  return ensureManagedMetadata(stripManagedMetadata(description)).trim();
}

function pushAction(
  report: SyncReport,
  status: SyncStatus,
  entity: SyncEntity,
  name: string,
  reason?: string
): void {
  report.actions.push({ status, entity, name, reason });
}
