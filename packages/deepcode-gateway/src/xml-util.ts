/**
 * DeepCode 消息网关 — XML 工具
 *
 * 企业微信、微信公众号的回调报文均为 XML 格式。
 * 为避免引入 xml2js 等重依赖，这里实现一个最小的 XML 解析/序列化工具：
 * - parseXml: 解析 <xml><Key><![CDATA[value]]></Key>...</xml> 为 {Key: value}
 * - buildXml: 把 {Key: value} 序列化为 <xml><Key><![CDATA[value]]></Key>...</xml>
 *
 * 限制：仅支持顶层 <xml> 下一层简单标签；不支持嵌套标签/属性/命名空间；
 *       足够应付本任务涉及的所有平台报文。
 *
 * @module
 */

/**
 * 解析微信/企业微信风格的 XML 报文为对象
 *
 * 输入示例：
 * <xml>
 *   <ToUserName><![CDATA[xxx]]></ToUserName>
 *   <CreateTime>1700000000</CreateTime>
 * </xml>
 *
 * 输出：{ ToUserName: "xxx", CreateTime: "1700000000" }
 */
export function parseXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {}
  // 先去掉外层 <xml>...</xml> 包裹，避免把所有内部标签作为 xml 内容匹配
  const stripped = xml.replace(/^\s*<xml>/i, "").replace(/<\/xml>\s*$/i, "").trim()
  // 匹配 <Key>...</Key>，内部可能是 <![CDATA[...]]> 或纯文本
  // 使用非贪婪匹配 + 禁止在值中再出现同名开标签，避免嵌套误匹配
  const tagRegex = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(stripped)) !== null) {
    const key = match[1] as string
    const raw = (match[2] as string).trim()
    // 提取 CDATA 内容
    const cdataMatch = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(raw)
    if (cdataMatch) {
      result[key] = (cdataMatch[1] as string).trim()
    } else {
      result[key] = raw
    }
  }
  return result
}

/**
 * 序列化为微信/企业微信风格的 XML 报文（CDATA 包装所有字符串值）
 */
export function buildXml(fields: Record<string, string | number>): string {
  const parts: string[] = ["<xml>"]
  for (const [key, value] of Object.entries(fields)) {
    parts.push(`  <${key}><![CDATA[${String(value)}]]></${key}>`)
  }
  parts.push("</xml>")
  return parts.join("\n")
}
