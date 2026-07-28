/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeDeepCodeContent from "./skill/customize-deepcode.md" with { type: "text" }

export const CustomizeDeepCodeContent = customizeDeepCodeContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-deepcode",
            description:
              "Use ONLY when the user is editing or creating DeepCode configuration: deepcode.json, deepcode.jsonc, files under .deepcode/, or files under the global DeepCode config directory. Also use when creating or fixing DeepCode agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for ordinary application code.",
            location: AbsolutePath.make("/builtin/customize-deepcode.md"),
            content: CustomizeDeepCodeContent,
          }),
        }),
      )
    })
  }),
})
