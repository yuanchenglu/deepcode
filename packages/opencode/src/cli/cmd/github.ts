import { Effect } from "effect"
import { cmd } from "./cmd"
import { effectCmd, fail } from "../effect-cmd"

export { extractResponseText, formatPromptTooLargeError, parseGitHubRemote } from "./github.shared"

const unavailable = () =>
  fail(
    "The GitHub agent is disabled until DeepCode provides a verified DeepCode-owned app, API endpoint, workflow, and sharing channel.",
  )

export const GithubInstallCommand = effectCmd({
  command: "install",
  describe: "install the GitHub agent (currently unavailable)",
  handler: Effect.fn("Cli.github.install")(unavailable),
})

export const GithubRunCommand = effectCmd({
  command: "run",
  describe: "run the GitHub agent (currently unavailable)",
  builder: (yargs) =>
    yargs
      .option("event", { type: "string", describe: "GitHub mock event to run the agent for" })
      .option("token", { type: "string", describe: "GitHub personal access token" }),
  handler: Effect.fn("Cli.github.run")(unavailable),
})

export const GithubCommand = cmd({
  command: "github",
  describe: "manage GitHub agent (currently unavailable)",
  builder: (yargs) => yargs.command(GithubInstallCommand).command(GithubRunCommand).demandCommand(),
  async handler() {},
})
