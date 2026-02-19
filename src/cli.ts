import yargs from "yargs";
import {
  assignIssue,
  assignProject,
  commentIssue,
  getIssueStatus,
  listProjectIssues,
  listProjects,
  moveIssue,
  startIssue,
  syncSpec
} from "./core";
import { SyncAction, SyncStatus } from "./linear/sync";
import { ListedProject, ListedProjectIssue } from "./linear/project";
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

interface ListProjectCommandArgs extends GlobalArgs {
  project: string;
}

interface ListProjectsCommandArgs extends GlobalArgs {}

interface MoveCommandArgs extends GlobalArgs {
  id: string;
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
        "list",
        "List issues for a project",
        (cmd) =>
          cmd.option("project", {
            type: "string",
            demandOption: true,
            description: "Project name"
          }),
        async (args) => {
          await handleListProjectCommand(
            {
              project: String(args.project),
              json: Boolean(args.json)
            },
            logger
          );
        }
      )
      .command(
        "projects",
        "List all projects in Linear",
        (cmd) => cmd,
        async (args) => {
          await handleListProjectsCommand({ json: Boolean(args.json) }, logger);
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
              demandOption: true,
              description: "Issue key (e.g. COG-12)"
            })
            .option("state", {
              type: "string",
              demandOption: true,
              description: "Workflow state name"
            }),
        async (args) => {
          await handleMoveCommand(
            {
              id: String(args.id),
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
    const status = await getIssueStatus(args.id);
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

async function handleListProjectCommand(
  args: ListProjectCommandArgs,
  logger: Logger
): Promise<void> {
  try {
    const issues = await listProjectIssues(args.project);
    if (args.json) {
      printOutput(issues, true, logger, []);
      return;
    }

    const lines = renderIssueTable(issues);
    for (const line of lines) {
      logger.info(line);
    }
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
}

async function handleListProjectsCommand(
  args: ListProjectsCommandArgs,
  logger: Logger
): Promise<void> {
  try {
    const projects = await listProjects();
    if (args.json) {
      printOutput(projects, true, logger, []);
      return;
    }

    const lines = renderProjectTable(projects);
    for (const line of lines) {
      logger.info(line);
    }
  } catch (error) {
    printError(error, args.json ?? false, logger);
  }
}

async function handleMoveCommand(args: MoveCommandArgs, logger: Logger): Promise<void> {
  try {
    const result = await moveIssue(args.id, args.state);

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
    const result = await commentIssue(args.id, args.text);

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
    const result = await assignIssue(args.id, args.user);

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
    const result = await startIssue(args.id);

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
    const result = await assignProject(args.project, args.force ?? false);

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
    const report = await syncSpec(args.file);

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

function renderIssueTable(issues: ListedProjectIssue[]): string[] {
  const columns = [
    "id",
    "identifier",
    "title",
    "state.name",
    "projectMilestoneId",
    "createdAt",
    "parentId",
    "assignee.displayName"
  ] as const;

  const rows = issues.map((issue) => [
    issue.id,
    issue.identifier ?? "",
    issue.title,
    issue.state.name ?? "",
    issue.projectMilestoneId ?? "",
    issue.createdAt,
    issue.parentId ?? "",
    issue.assignee.displayName ?? ""
  ]);

  const widths = columns.map((column, columnIndex) => {
    const cellWidths = rows.map((row) => row[columnIndex].length);
    return Math.max(column.length, ...cellWidths, 1);
  });

  const formatRow = (cells: string[]): string =>
    cells
      .map((cell, index) => cell.padEnd(widths[index], " "))
      .join("  ");

  const header = formatRow([...columns]);
  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const data = rows.map((row) => formatRow(row));

  return [header, divider, ...data];
}

function renderProjectTable(projects: ListedProject[]): string[] {
  const columns = [
    "id",
    "name",
    "state",
    "progress",
    "startDate",
    "targetDate",
    "lead.displayName",
    "createdAt",
    "updatedAt"
  ] as const;

  const rows = projects.map((project) => [
    project.id,
    project.name,
    project.state ?? "",
    project.progress !== null ? String(project.progress) : "",
    project.startDate ?? "",
    project.targetDate ?? "",
    project.lead.displayName ?? "",
    project.createdAt,
    project.updatedAt
  ]);

  const widths = columns.map((column, columnIndex) => {
    const cellWidths = rows.map((row) => row[columnIndex].length);
    return Math.max(column.length, ...cellWidths, 1);
  });

  const formatRow = (cells: string[]): string =>
    cells
      .map((cell, index) => cell.padEnd(widths[index], " "))
      .join("  ");

  const header = formatRow([...columns]);
  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const data = rows.map((row) => formatRow(row));

  return [header, divider, ...data];
}
