import { Effect } from "effect"
import { define } from "@opencode-ai/plugin/v2/effect/plugin"
import { startGateway, stopGateway, registerAdapter } from "./lifecycle"
import { FeishuAdapter } from "./feishu/adapter"
import { WeChatAdapter } from "./wechat/adapter"

export const gatewayPlugin = define({
  id: "@deepcode/gateway",
  effect: (context) =>
    Effect.gen(function* () {
      const config = (context.options as Record<string, unknown>)?.gateway as Record<string, unknown> | undefined
      if (!config) return

      const fc = config.feishu as Record<string, unknown> | undefined
      const wc = config.wechat as Record<string, unknown> | undefined

      if (fc?.enabled) {
        registerAdapter(new FeishuAdapter({ enabled: true, appId: (fc.appId as string) || "", appSecret: (fc.appSecret as string) || "", webhook: "/webhook/feishu", port: 3099 }))
      }
      if (wc?.enabled) {
        registerAdapter(new WeChatAdapter({ enabled: true, mode: (wc.mode as "wecom" | "ilink") || "wecom", corpId: (wc.corpId as string) || "", agentId: (wc.agentId as string) || "", secret: (wc.secret as string) || "" }))
      }

      yield* Effect.ignore(startGateway((fc?.port as number) || 3099))
    }),
})
