/**
 * DeepCode 消息网关 — 极简 XML 工具
 *
 * 仅用于解析企业微信/微信公众号回调 XML、以及拼装回复 XML。
 * 不引入第三方依赖；不追求完整 XML 标准兼容，仅覆盖平台回调使用的子集：
 *  - 全部元素都在 <xml> 根下
 *  - 文本节点用 CDATA 或纯文本
 *
 * @module crypto/xml
 */

/**
 * 解析形如：
 *   <xml><ToUserName><![CDATA[xxx]]></ToUserName>...</xml>
 * 返回 Record<string,string>
 */
export function parseXml(xml: string): Record<string, string> {
  const out: Record<string, string> = {}
  // 先剥掉最外层 <xml>...</xml>
  const inner = xml.replace(/^\s*<xml>|<\/xml>\s*$/g, "")
  // 非贪婪匹配每个 <Tag>...</Tag>；用 [\s\S]*? 但 CDATA 内的 ]] 会导致过早结束，
  // 所以用 <(Tag)>(...)<\/\1> 按 m[0] 完整匹配；只要 XML 是平台生成的规范格式就没问题。
  const tagRe = /<([A-Za-z0-9_]+)>/g
  let tagMatch: RegExpExecArray | null
  while ((tagMatch = tagRe.exec(inner)) !== null) {
    const tag = tagMatch[1]!
    const startIdx = tagMatch.index + tagMatch[0].length
    const closeTag = `</${tag}>`
    const closeIdx = inner.indexOf(closeTag, startIdx)
    if (closeIdx < 0) continue
    let val = inner.slice(startIdx, closeIdx)
    // 去除 CDATA 包裹（<![CDATA[...]]>）
    const cdata = val.match(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/)
    if (cdata) val = cdata[1] ?? ""
    val = val.trim()
    out[tag] = val
    // 跳过已处理到的位置，避免在 CDATA 里误匹配
    tagRe.lastIndex = closeIdx + closeTag.length
  }
  return out
}

/**
 * 把 Record<string,string> 序列化为 <xml> 文档，值用 CDATA 包裹。
 */
export function buildXml(entries: Record<string, string | number>): string {
  const parts: string[] = ["<xml>"]
  for (const [k, v] of Object.entries(entries)) {
    parts.push(`<${k}><![CDATA[${String(v)}]]></${k}>`)
  }
  parts.push("</xml>")
  return parts.join("")
}
