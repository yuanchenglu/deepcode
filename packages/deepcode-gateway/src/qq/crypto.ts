export function stripAtMentions(content: string, botId?: string): string {
  if (!botId) return content.trim()
  return content.replace(new RegExp(`<@!?${botId}>`, "g"), "").trim()
}
