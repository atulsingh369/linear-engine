import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import yargs from "yargs";
import { createLogger } from "./utils/logger";
import { syncProject, SyncAction, SyncStatus } from "./linear/sync";
import { EpicSpec, ProjectSpec, StorySpec } from "./linear/types";

interface SyncCommandArgs {
  file: string;
}

export async function runCli(argv: string[]): Promise<void> {
  const logger = createLogger();

  try {
    await yargs(argv)
      .scriptName("linear")
      .usage("$0 <command> [options]")
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
          await handleSyncCommand({ file: String(args.file) }, logger);
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
    const message = error instanceof Error ? error.message : "Unknown CLI error";
    logger.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

async function handleSyncCommand(
  args: SyncCommandArgs,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const spec = await loadProjectSpecFromFile(args.file);
    const report = await syncProject(spec);

    printActionsByStatus("Created", report.actions, logger);
    printActionsByStatus("Updated", report.actions, logger);
    printActionsByStatus("Skipped", report.actions, logger);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Error: ${message}`);
    process.exitCode = 1;
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

function printActionsByStatus(
  status: SyncStatus,
  actions: SyncAction[],
  logger: ReturnType<typeof createLogger>
): void {
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
  return (
    isRecord(value) &&
    isNonEmptyString(value.title) &&
    isString(value.description)
  );
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
