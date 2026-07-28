import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Product } from "@opencode-ai/core/product"

export const UpgradeCommand = {
  command: "upgrade [target]",
  describe: `upgrade ${Product.name} through the verified release channel`,
  builder: (yargs: Argv) =>
    yargs
      .positional("target", {
        describe: "version to upgrade to, for example '0.1.0' or 'v0.1.0'",
        type: "string",
      })
      .option("method", {
        alias: "m",
        describe: "installation method to use",
        type: "string",
        choices: ["curl"],
      }),
  handler: async (args: { target?: string; method?: string }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro(`Upgrade ${Product.name}`)

    const detectedMethod = await Installation.method()
    const method = (args.method as Installation.Method | undefined) ?? detectedMethod
    if (method === "unknown") {
      prompts.log.error(
        `${Product.name} is running from ${process.execPath}, which is not a verified ${Product.config.directory}/bin installation.`,
      )
      prompts.log.info("Upgrade stopped without contacting any release or package-manager endpoint.")
      prompts.outro("Done")
      return
    }

    const target = args.target ? args.target.replace(/^v/, "") : await Installation.latest(method)
    if (!args.target && target === InstallationVersion) {
      prompts.log.warn("Automatic upgrades are disabled until the verified DeepCode release channel is available.")
      prompts.outro("Done")
      return
    }

    if (InstallationVersion === target) {
      prompts.log.warn(`${Product.name} upgrade skipped: ${target} is already installed`)
      prompts.outro("Done")
      return
    }

    prompts.log.info(`From ${InstallationVersion} → ${target}`)
    const spinner = prompts.spinner()
    spinner.start("Upgrading...")
    const err = await Installation.upgrade(method, target).catch((error) => error)
    if (err) {
      spinner.stop("Upgrade failed", 1)
      if (err instanceof Installation.UpgradeFailedError) prompts.log.error(err.stderr)
      else if (err instanceof Error) prompts.log.error(err.message)
      prompts.outro("Done")
      return
    }

    spinner.stop("Upgrade complete")
    prompts.outro("Done")
  },
}
