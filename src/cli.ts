import yargs from "yargs";

export async function runCli(argv: string[]): Promise<void> {
  await yargs(argv)
    .scriptName("linear")
    .usage("$0 <command> [options]")
    .command(
      "sync",
      "Sync data with Linear",
      () => {},
      async () => {
        // Business logic intentionally not implemented yet.
      }
    )
    .demandCommand(1, "Provide a command")
    .strict()
    .help()
    .parseAsync();
}
