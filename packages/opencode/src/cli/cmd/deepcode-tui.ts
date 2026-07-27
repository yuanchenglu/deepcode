import type { Argv, CommandModule } from "yargs"
import { TuiThreadCommand as BaseTuiThreadCommand } from "./tui"

const baseBuilder = BaseTuiThreadCommand.builder

export const TuiThreadCommand: CommandModule = {
  ...BaseTuiThreadCommand,
  describe: "start DeepCode TUI",
  builder: (yargs: Argv) => {
    const built = typeof baseBuilder === "function" ? baseBuilder(yargs) : baseBuilder ? yargs.options(baseBuilder) : yargs
    return built.positional("project", {
      type: "string",
      describe: "path to start DeepCode in",
    })
  },
}
