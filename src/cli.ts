import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import yargs from "yargs";
import { assignIssueToUser, addCommentToIssue, getIssueStatusByKey, moveIssueByKeyToState, moveIssueToState, startIssueByKey } from "./linear/issue";
import { assignProjectIssues } from "./linear/project";
import { syncProject, SyncAction, SyncStatus } from "./linear/sync";
import { EpicSpec, ProjectSpec, StorySpec } from "./linear/types";
import { createLogger, Logger } from "./utils/logger";

interface GlobalArgs {
  json?: boolean;
}

interface SyncCommandArgs extends GlobalArgs {
  file: string;
}

interface AssignProjectCommandArgs extends GlobalArgs {
  project: string;
  force?: boolean;
}

interface MoveCommandArgs extends GlobalArgs {
  issue?: string;
  id?: string;
  state: string;
}

interface StatusCommandArgs extends GlobalArgs {
  id: string;
}

interface CommentCommandArgs extends GlobalArgs {
  id: string;
  text: string;
}

interface AssignCommandArgs extends GlobalArgs {
  id: string;
  user: string;
}

interface StartCommandArgs extends GlobalArgs {
  id: string;
}

export async function runCli(argv: string[]): Promise<void> {
  const logger = createLogger();

  try {
    await yargs(argv)
      .scriptName("linear")
      .usage("$0 <command> [options]")
      .option("json", {
        type: "boolean",
        default: false,
        description: "Print JSON output"
      })
      .command(
        "sync",
        "Sync project state to Linear",
        (cmd) =>
          cmd.option("file", {
            type: "string",
            demandOption: true,
            description: "Path to ProjectSpec JSON file"
          }),
        async (args) => {
          await handleSyncCommand(
            { file: String(args.file), json: Boolean(args.json) },
            logger
          );
        }
      )
      .command(
        "assign-project",
        "Assign issues in a project to the current user",
        (cmd) =>
          cmd
            .option("project", {
              type: "string",
              demandOption: true,
              description: "Project name"
            })
            .option("force", {
              type: "boolean",
              default: false,
              description: "Reassign all issues even if already assigned"
            }),
        async (args) => {
          await handleAssignProjectCommand(
            {
              project: String(args.project),
              force: Boolean(args.force),
              json: Boolean(args.json)
            },
            logger
          );
        }
      )
      .command(
        "status",
        "Show issue status by issue key",
        (cmd) =>
          cmd.option("id", {
            type: "string",
            demandOption: true,
            description: "Issue key (e.g. COG-12)"
          }),
        async (args) => {
          await handleStatusCommand(
            { id: String(args.id), json: Boolean(args.json) },
            logger
          );
        }
      )
      .command(
        "move",
        "Move issue to a workflow state",
        (cmd) =>
          cmd
            .option("id", {
              type: "string",
              demandOption: false,
              description: "Issue key (e.g. COG-12)"
            })
            .option("issue", {
              type: "string",
              demandOption: false,
              description: "Exact issue title"
            })
            .option("state", {
              type: "string",
              demandOption: true,
              description: "Workflow state name"
            }),
        async (args) => {
          await handleMoveCommand(
            {
              id: args.id ? String(args.id) : undefined,
              issue: args.issue ? String(args.issue) : undefined,
              state: String(args.state),
              json: Boolean(args.json)
            },
            logger
          );
        }
      )
      .command(
        "comment",
        "Add a comment to an issue by key",
        (cmd) =>
          cmd
            .option("id", {
              type: "string",
              demandOption: true,
              description: "Issue key (e.g. COG-12)"
            })
            .option("text", {
              type: "string",
              demandOption: true,
              description: "Comment text"
            }),
        async (args) => {
          await handleCommentCommand(
            {
              id: String(args.id),
              text: String(args.text),
              json: Boolean(args.json)
            },
            logger
          );
        }
      )
      .command(
        "assign",
        "Assign an issue to a user",
        (cmd) =>
          cmd
            .option("id", {
              type: "string",
              demandOption: true,
              description: "Issue key (e.g. COG-12)"
            })
            .option("user", {
              type: "string",
              demandOption: true,
              description: "User ID, username, display name, or email"
            }),
        async (args) => {
          await handleAssignCommand(
            {
              id: String(args.id),
              user: String(args.user),
              json: Boolean(args.json)
            },
            logger
          );
        }
      )
      .command(
        "start",
        "Move an issue to the first active workflow state",
        (cmd) =>
          cmd.option("id", {
            type: "string",
            demandOption: true,
            description: "Issue key (e.g. COG-12)"
          }),
        async (args) => {
          await handleStartCommand(
            { id: String(args.id), json: Boolean(args.json) },
            logger
          );
        }
      )
      .demandCommand(1, "Provide a command")
      .strict()
      .help()
      .fail((message, error) => {
        throw error ?? new Error(message);
      })
      .parseAsync();
  } catch (error) {
    printError(error, false, logger);
  }
}

async function handleStatusCommand(args: StatusCommandArgs, logger: Logger): Promise<void> {
  try {
    const status = await getIssueStatusByKey(args.id);
    printOutput(
      {
        issueKey: status.issueKey,
        title: status.title,
        state: status.state,
        assignee: status.assignee,
        project: status.project
      },
      args.json ?? false,
      logger,
      [
        `Issue key: ${status.issueKey}`,
        `Title: ${status.title}`,
        `State: ${status.state}`,
        `Assignee: ${status.assignee}`,
        `Project: ${status.project}`
      ]
    );
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
}

async function handleMoveCommand(args: MoveCommandArgs, logger: Logger): Promise<void> {
  try {
    const hasIssue = Boolean(args.issue);
    const hasId = Boolean(args.id);

    if (hasIssue === hasId) {
      throw new Error('Provide exactly one of "--id" or "--issue".');
    }

    const result = hasId
      ? await moveIssueByKeyToState({
          issueKey: args.id as string,
          stateName: args.state
        })
      : await moveIssueToState({
          title: args.issue as string,
          stateName: args.state
        });

    printOutput(
      {
        issueKey: result.issueKey,
        previousState: result.previousState,
        newState: result.newState
      },
      args.json ?? false,
      logger,
      [`Moved ${result.issueKey} from ${result.previousState} to ${result.newState}`]
    );
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
}

async function handleCommentCommand(args: CommentCommandArgs, logger: Logger): Promise<void> {
  try {
    const result = await addCommentToIssue({
      issueKey: args.id,
      text: args.text
    });

    printOutput(
      {
        issueKey: result.issueKey,
        success: true
      },
      args.json ?? false,
      logger,
      [`Comment added to ${result.issueKey}`]
    );
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
}

async function handleAssignCommand(args: AssignCommandArgs, logger: Logger): Promise<void> {
  try {
    const result = await assignIssueToUser({
      issueKey: args.id,
      userIdentifier: args.user
    });

    printOutput(
      {
        issueKey: result.issueKey,
        assignee: result.assignee,
        success: true
      },
      args.json ?? false,
      logger,
      [`Assigned ${result.issueKey} to ${result.assignee}`]
    );
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
}

async function handleStartCommand(args: StartCommandArgs, logger: Logger): Promise<void> {
  try {
    const result = await startIssueByKey(args.id);

    printOutput(
      {
        issueKey: result.issueKey,
        previousState: result.previousState,
        newState: result.newState
      },
      args.json ?? false,
      logger,
      [`Started ${result.issueKey}: ${result.previousState} -> ${result.newState}`]
    );
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
}

async function handleAssignProjectCommand(
  args: AssignProjectCommandArgs,
  logger: Logger
): Promise<void> {
  try {
    const result = await assignProjectIssues({
      projectName: args.project,
      force: args.force ?? false
    });

    printOutput(
      {
        totalIssues: result.totalIssues,
        assignedCount: result.assignedCount,
        skippedCount: result.skippedCount,
        forced: args.force ?? false
      },
      args.json ?? false,
      logger,
      [
        `Total issues: ${result.totalIssues}`,
        `Assigned count: ${result.assignedCount}`,
        `Skipped count: ${result.skippedCount}`
      ]
    );
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
}

async function handleSyncCommand(args: SyncCommandArgs, logger: Logger): Promise<void> {
  try {
    const spec = await loadProjectSpecFromFile(args.file);
    const report = await syncProject(spec);

    if (args.json) {
      printOutput(report, true, logger, []);
      return;
    }

    printActionsByStatus("Created", report.actions, logger);
    printActionsByStatus("Updated", report.actions, logger);
    printActionsByStatus("Skipped", report.actions, logger);
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
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

function printOutput(payload: unknown, json: boolean, logger: Logger, lines: string[]): void {
  if (json) {
    logger.info(JSON.stringify(payload, null, 2));
    return;
  }

  for (const line of lines) {
    logger.info(line);
  }
}

function printError(error: unknown, json: boolean, logger: Logger): void {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (json) {
    logger.error(JSON.stringify({ error: message }, null, 2));
  } else {
    logger.error(`Error: ${message}`);
  }

  process.exitCode = 1;
}

function printActionsByStatus(status: SyncStatus, actions: SyncAction[], logger: Logger): void {
  const matching = actions.filter((action) => action.status === status);

  logger.info(`${status}: ${matching.length}`);
  for (const action of matching) {
    const reasonSuffix = action.reason ? ` (${action.reason})` : "";
    logger.info(`- ${action.entity}: ${action.name}${reasonSuffix}`);
  }
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
