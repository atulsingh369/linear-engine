import { createLinearApiClient, LinearApiClient } from "./client";
import { ProjectSpec } from "./types";

const MANAGED_METADATA = "---\nmanagedBy: linear-engine\n---";

export type SyncStatus = "Created" | "Updated" | "Skipped";
export type SyncEntity = "project" | "milestone" | "epic" | "story";

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
};

type MilestoneLike = {
  name: string;
};

type IssueLike = {
  id: string;
  title: string;
  description?: string | null;
  teamId?: string | null;
  parentId?: string | null;
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
  const desiredMilestones = spec.milestones ?? [];
  if (desiredMilestones.length === 0) {
    return;
  }

  const existingMilestones = await getProjectMilestones(project);
  const existingNames = new Set(existingMilestones.map((milestone) => milestone.name));

  for (const milestone of desiredMilestones) {
    if (!existingNames.has(milestone.name)) {
      await client.createMilestone({
        projectId: project.id,
        name: milestone.name
      });
      pushAction(report, "Created", "milestone", milestone.name);
      continue;
    }

    pushAction(report, "Skipped", "milestone", milestone.name, "already exists");
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
  const teamId = await resolveTeamId(client, project, issues);

  for (const epicSpec of desiredEpics) {
    let epicIssue = findIssueByTitle(issues, epicSpec.title, null);

    if (!epicIssue) {
      const createdEpic = await client.createIssue({
        teamId,
        projectId: project.id,
        title: epicSpec.title,
        description: withManagedMetadata(epicSpec.description)
      });
      epicIssue = (createdEpic as { issue?: IssueLike }).issue ?? null;
      if (!epicIssue) {
        throw new Error(`Failed to create epic \"${epicSpec.title}\".`);
      }

      issues.push(epicIssue);
      pushAction(report, "Created", "epic", epicSpec.title);
    } else {
      const desiredEpicDescription = epicSpec.description;
      const currentEpicDescription = stripManagedMetadata(epicIssue.description);

      if (currentEpicDescription === desiredEpicDescription) {
        pushAction(report, "Skipped", "epic", epicSpec.title, "description unchanged");
      } else if (!isManaged(epicIssue.description)) {
        pushAction(report, "Skipped", "epic", epicSpec.title, "not managed by tool");
      } else {
        await client.updateIssue(epicIssue.id, {
          description: withManagedMetadata(desiredEpicDescription)
        });
        epicIssue.description = withManagedMetadata(desiredEpicDescription);
        pushAction(report, "Updated", "epic", epicSpec.title);
      }
    }

    const desiredStories = epicSpec.stories ?? [];
    for (const storySpec of desiredStories) {
      let storyIssue = findIssueByTitle(issues, storySpec.title, epicIssue.id);

      if (!storyIssue) {
        const createdStory = await client.createIssue({
          teamId,
          projectId: project.id,
          parentId: epicIssue.id,
          title: storySpec.title,
          description: withManagedMetadata(storySpec.description)
        });
        storyIssue = (createdStory as { issue?: IssueLike }).issue ?? null;
        if (!storyIssue) {
          throw new Error(`Failed to create story \"${storySpec.title}\".`);
        }

        issues.push(storyIssue);
        pushAction(report, "Created", "story", storySpec.title);
      } else {
        const desiredStoryDescription = storySpec.description;
        const currentStoryDescription = stripManagedMetadata(storyIssue.description);

        if (currentStoryDescription === desiredStoryDescription) {
          pushAction(report, "Skipped", "story", storySpec.title, "description unchanged");
        } else if (!isManaged(storyIssue.description)) {
          pushAction(report, "Skipped", "story", storySpec.title, "not managed by tool");
        } else {
          await client.updateIssue(storyIssue.id, {
            description: withManagedMetadata(desiredStoryDescription)
          });
          storyIssue.description = withManagedMetadata(desiredStoryDescription);
          pushAction(report, "Updated", "story", storySpec.title);
        }
      }
    }
  }
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

async function getProjectMilestones(project: ProjectLike): Promise<MilestoneLike[]> {
  const milestoneGetter = (
    project as {
      projectMilestones?: () => Promise<{ nodes: MilestoneLike[] }>;
    }
  ).projectMilestones;

  if (typeof milestoneGetter !== "function") {
    return [];
  }

  const result = await milestoneGetter.call(project);
  return result.nodes;
}

async function resolveTeamId(
  client: LinearApiClient,
  project: ProjectLike,
  issues: IssueLike[]
): Promise<string> {
  const explicitTeamId = (project as { teamId?: string | null }).teamId;
  if (explicitTeamId) {
    return explicitTeamId;
  }

  const teamIds = (project as { teamIds?: string[] | null }).teamIds;
  if (teamIds && teamIds.length > 0) {
    return teamIds[0];
  }

  const issueTeamId = issues.find((issue) => Boolean(issue.teamId))?.teamId;
  if (issueTeamId) {
    return issueTeamId;
  }

  const teamConnectionGetter = (
    project as {
      teams?: () => Promise<{ nodes: Array<{ id: string }> }>;
    }
  ).teams;
  if (typeof teamConnectionGetter === "function") {
    const teams = await teamConnectionGetter.call(project);
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

function withManagedMetadata(description: string): string {
  return `${description.trim()}\n\n${MANAGED_METADATA}`;
}

function stripManagedMetadata(description: string | null | undefined): string {
  if (!description) {
    return "";
  }

  return description.replace(/\n?\n?---\nmanagedBy: linear-engine\n---\s*$/u, "").trim();
}

function isManaged(description: string | null | undefined): boolean {
  if (!description) {
    return false;
  }

  return description.includes(MANAGED_METADATA);
}
