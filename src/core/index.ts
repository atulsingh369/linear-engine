import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assignIssueToUser, addCommentToIssue, getIssueStatusByKey, moveIssueByKeyToState, startIssueByKey } from "../linear/issue";
import { assignProjectIssues, listProjectIssues as listIssuesByProject, listProjects as listAllProjects } from "../linear/project";
import { syncProject } from "../linear/sync";
import { EpicSpec, ProjectSpec, StorySpec } from "../linear/types";

export async function getIssueStatus(id: string) {
  return getIssueStatusByKey(id);
}

export async function moveIssue(id: string, state: string) {
  return moveIssueByKeyToState({ issueKey: id, stateName: state });
}

export async function assignIssue(id: string, user: string) {
  return assignIssueToUser({ issueKey: id, userIdentifier: user });
}

export async function startIssue(id: string) {
  return startIssueByKey(id);
}

export async function commentIssue(id: string, text: string) {
  return addCommentToIssue({ issueKey: id, text });
}

export async function listProjectIssues(project: string) {
  return listIssuesByProject({ projectName: project });
}

export async function listProjects() {
  return listAllProjects();
}

export async function syncSpec(filePath: string) {
  const spec = await loadProjectSpecFromFile(filePath);
  return syncProject(spec);
}

export async function assignProject(project: string, force = false) {
  return assignProjectIssues({ projectName: project, force });
}

async function loadProjectSpecFromFile(filePath: string): Promise<ProjectSpec> {
  const absolutePath = resolve(process.cwd(), filePath);

  let raw: string;
  try {
    raw = await readFile(absolutePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown read error";
    throw new Error(`Failed to read spec file at ${absolutePath}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Invalid JSON in ${absolutePath}: ${message}`);
  }

  if (!isProjectSpec(parsed)) {
    throw new Error(
      `Invalid ProjectSpec in ${absolutePath}. Expected shape: { project: { name, description }, milestones?, epics? }.`
    );
  }

  return parsed;
}

function isProjectSpec(value: unknown): value is ProjectSpec {
  if (!isRecord(value)) {
    return false;
  }

  if (!isRecord(value.project)) {
    return false;
  }

  if (!isNonEmptyString(value.project.name) || !isString(value.project.description)) {
    return false;
  }

  if (value.milestones !== undefined) {
    if (!Array.isArray(value.milestones)) {
      return false;
    }

    const milestonesAreValid = value.milestones.every(
      (milestone) => isRecord(milestone) && isNonEmptyString(milestone.name)
    );
    if (!milestonesAreValid) {
      return false;
    }
  }

  if (value.epics !== undefined) {
    if (!Array.isArray(value.epics)) {
      return false;
    }

    const epicsAreValid = value.epics.every((epic) => isEpicSpec(epic));
    if (!epicsAreValid) {
      return false;
    }
  }

  return true;
}

function isEpicSpec(value: unknown): value is EpicSpec {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.title) || !isString(value.description)) {
    return false;
  }

  if (value.assignee !== undefined && !isString(value.assignee)) {
    return false;
  }

  if (value.milestone !== undefined && !isString(value.milestone)) {
    return false;
  }

  if (value.stories !== undefined) {
    if (!Array.isArray(value.stories)) {
      return false;
    }

    const storiesAreValid = value.stories.every((story) => isStorySpec(story));
    if (!storiesAreValid) {
      return false;
    }
  }

  return true;
}

function isStorySpec(value: unknown): value is StorySpec {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.title) || !isString(value.description)) {
    return false;
  }

  if (value.assignee !== undefined && !isString(value.assignee)) {
    return false;
  }

  if (value.milestone !== undefined && !isString(value.milestone)) {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}
