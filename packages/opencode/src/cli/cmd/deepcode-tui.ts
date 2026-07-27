import type { Argv } from "yargs"
import { TuiThreadCommand as BaseTuiThreadCommand } from "./tui"

const baseBuilder = BaseTuiThreadCommand.builder as (yargs: Argv) => Argv

export const TuiThreadCommand = {
  ...BaseTuiThreadCommand,
  describe: "start DeepCode TUI",
  builder: (yargs: Argv) =>
    baseBuilder(yargs).positional("project", {
      type: "string",
      describe: "path to start DeepCode in",
    }),
} satisfies typeof BaseTuiThreadCommand
